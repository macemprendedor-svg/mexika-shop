import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { computeConfirmationSchedule } from "@/lib/confirmation-schedule";
import { applyQuantityFilter, type QuantityFilterResult } from "@/lib/quantity-filter";
import { markOrderAsPaidForDropi } from "@/lib/dropi-handoff";
import { isZoneBlocked } from "@/lib/zone-block";
import { extractPostalCode } from "@/lib/shipping-address";
import { hasRejectionHistory } from "@/lib/customer-risk";
import type { ConfirmationChannel, Order } from "@prisma/client";

const CONFIRMATION_LINK_TTL_HOURS = 48;
// Cuánto esperar después del SMS antes de cancelar por no confirmar (sección 2.6).
// El spec no da un número exacto para este margen; 1h es nuestra elección,
// a revisar si no es el comportamiento deseado.
const UNCONFIRMED_CANCEL_GRACE_HOURS = 1;

export class OrderServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrderServiceError";
  }
}

async function recordHistory(
  orderId: string,
  previousStatus: string | null,
  newStatus: string,
  source: string,
  note?: string,
) {
  await prisma.orderStatusHistory.create({
    data: { orderId, previousStatus, newStatus, source, note },
  });
}

export type ShopifyOrderWebhookPayload = {
  id: number | string;
  name: string;
  created_at: string;
  email?: string | null;
  phone?: string | null;
  customer?: { email?: string | null; phone?: string | null } | null;
  total_price: string;
  currency: string;
  shipping_address?: Record<string, unknown> | null;
  line_items: Array<{ title: string; quantity: number; price: string }>;
  tags?: string | null; // string separado por comas, tal como lo manda Shopify
};

const PREPAID_TAG = "pago-anticipado";

/**
 * true si el pedido trae la etiqueta "pago-anticipado" — ese flujo lo maneja
 * el módulo aparte de pago anticipado con Mercado Pago, no debe entrar a la
 * lógica de confirmación de COD de este proyecto.
 */
export function isPrepaidOrder(tags: string | null | undefined): boolean {
  if (!tags) return false;
  return tags
    .split(",")
    .map((tag) => tag.trim().toLowerCase())
    .includes(PREPAID_TAG);
}

/**
 * Crea el pedido en nuestra base a partir del webhook orders/create de
 * Shopify. Idempotente por shopifyOrderId: si ya existe, no duplica.
 */
export async function createOrderFromShopifyWebhook(
  payload: ShopifyOrderWebhookPayload,
): Promise<Order> {
  const shopifyOrderId = `gid://shopify/Order/${payload.id}`;

  const existing = await prisma.order.findUnique({ where: { shopifyOrderId } });
  if (existing) return existing;

  const shopifyCreatedAt = new Date(payload.created_at);
  const schedule = computeConfirmationSchedule(shopifyCreatedAt);
  const totalQuantity = payload.line_items.reduce((sum, li) => sum + li.quantity, 0);

  const order = await prisma.order.create({
    data: {
      shopifyOrderId,
      shopifyOrderName: payload.name,
      customerEmail: payload.email ?? payload.customer?.email ?? null,
      customerPhone: payload.phone ?? payload.customer?.phone ?? null,
      totalQuantity,
      totalPrice: payload.total_price,
      currency: payload.currency,
      shippingAddressJson: payload.shipping_address
        ? JSON.stringify(payload.shipping_address)
        : null,
      lineItemsJson: JSON.stringify(payload.line_items),
      shopifyCreatedAt,
      scheduledEmail2At: schedule.email2At,
      scheduledSmsAt: schedule.smsAt,
      confirmationToken: randomUUID(),
      confirmationTokenExpiresAt: new Date(
        shopifyCreatedAt.getTime() + CONFIRMATION_LINK_TTL_HOURS * 60 * 60 * 1000,
      ),
      rawPayload: JSON.stringify(payload),
    },
  });

  await recordHistory(order.id, null, order.status, "webhook:orders/create");
  return order;
}

export async function getOrderByToken(token: string): Promise<Order | null> {
  return prisma.order.findUnique({ where: { confirmationToken: token } });
}

/**
 * Aplica el filtro de cantidad (sección 3) y, si pasa automático, dispara el
 * envío controlado a Dropi (orderMarkAsPaid). Devuelve el pedido actualizado.
 */
async function applyQuantityFilterAndAdvance(order: Order, source: string): Promise<Order> {
  const result: QuantityFilterResult = applyQuantityFilter(order.totalQuantity);

  if (result === "BLOCKED") {
    const updated = await prisma.order.update({
      where: { id: order.id },
      data: { status: "BLOCKED_QUANTITY", quantityFilterResult: result },
    });
    await recordHistory(
      order.id,
      order.status,
      "BLOCKED_QUANTITY",
      source,
      `Bloqueado por cantidad (${order.totalQuantity} unidades)`,
    );
    return updated;
  }

  if (result === "NEEDS_REVIEW") {
    const updated = await prisma.order.update({
      where: { id: order.id },
      data: { status: "QUANTITY_REVIEW", quantityFilterResult: result },
    });
    await recordHistory(
      order.id,
      order.status,
      "QUANTITY_REVIEW",
      source,
      `Requiere revisión humana (${order.totalQuantity} unidades)`,
    );
    return updated;
  }

  // AUTO_APPROVE: enviar controladamente a Dropi.
  return sendToDropiAndAdvance(order, source);
}

/**
 * Ejecuta el handoff a Dropi (orderMarkAsPaid) y actualiza el estado. Si la
 * mutación falla, el pedido queda en CONFIRMED con el error registrado en el
 * historial para revisión humana (sección 7: alerta de "confirmado que no
 * llegó a Dropi").
 */
export async function sendToDropiAndAdvance(
  order: Order,
  source: string,
  options: { bypassZoneGate?: boolean } = {},
): Promise<Order> {
  const postalCode = options.bypassZoneGate ? null : extractPostalCode(order.shippingAddressJson);
  if (postalCode) {
    // La transportadora todavía no se conoce en este punto (Dropi la asigna
    // después), así que solo se evalúan bloqueos de CP puro.
    const blocked = await isZoneBlocked(postalCode);
    if (blocked) {
      const updated = await prisma.order.update({
        where: { id: order.id },
        data: { status: "PAUSED_ZONE_BLOCKED" },
      });
      await recordHistory(
        order.id,
        order.status,
        "PAUSED_ZONE_BLOCKED",
        source,
        `Zona bloqueada: ${blocked.reason}`,
      );
      return updated;
    }
  }

  try {
    await markOrderAsPaidForDropi(order.shopifyOrderId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    await recordHistory(
      order.id,
      order.status,
      order.status,
      source,
      `Falló el envío a Dropi (orderMarkAsPaid): ${message}`,
    );
    throw new OrderServiceError(`No se pudo enviar el pedido a Dropi: ${message}`);
  }

  const updated = await prisma.order.update({
    where: { id: order.id },
    data: {
      status: "SENT_TO_DROPI",
      quantityFilterResult: order.quantityFilterResult ?? "AUTO_APPROVE",
      markedPaidAt: new Date(),
    },
  });
  await recordHistory(order.id, order.status, "SENT_TO_DROPI", source);
  return updated;
}

/**
 * Confirma el pedido (por correo, SMS, o reingreso manual) y lo pasa al
 * filtro de cantidad (sección 3).
 */
export async function confirmOrder(
  orderId: string,
  via: ConfirmationChannel,
  source: string,
): Promise<Order> {
  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });

  if (order.status !== "PENDING_CONFIRMATION" && order.status !== "CANCELLED_NOT_CONFIRMED") {
    throw new OrderServiceError(
      `El pedido ${order.shopifyOrderName} no está en un estado confirmable (${order.status})`,
    );
  }

  const confirmed = await prisma.order.update({
    where: { id: order.id },
    data: { status: "CONFIRMED", confirmedAt: new Date(), confirmedVia: via },
  });
  await recordHistory(order.id, order.status, "CONFIRMED", source);

  // Puntuación de riesgo del cliente (sección 4.2): un rechazo real previo
  // (no un rechazo falso de la transportadora) exige revisión humana antes
  // de seguir, sin importar la cantidad de este pedido nuevo.
  const hasRejection = await hasRejectionHistory(
    confirmed.customerEmail,
    confirmed.customerPhone,
    confirmed.id,
  );
  if (hasRejection) {
    const flagged = await prisma.order.update({
      where: { id: confirmed.id },
      data: { status: "CUSTOMER_RISK_REVIEW" },
    });
    await recordHistory(
      confirmed.id,
      "CONFIRMED",
      "CUSTOMER_RISK_REVIEW",
      source,
      "El cliente tiene un rechazo de entrega real en un pedido anterior",
    );
    return flagged;
  }

  return applyQuantityFilterAndAdvance(confirmed, source);
}

/**
 * Decisión humana sobre un pedido en revisión por historial de rechazos
 * (sección 4.2). APPROVED sigue el flujo normal (filtro de cantidad);
 * REJECTED corta el pedido.
 */
export async function decideCustomerRiskReview(
  orderId: string,
  decision: "APPROVED" | "REJECTED",
  decidedBy: string,
): Promise<Order> {
  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
  if (order.status !== "CUSTOMER_RISK_REVIEW") {
    throw new OrderServiceError(
      `El pedido ${order.shopifyOrderName} no está en revisión de riesgo de cliente (estado actual: ${order.status})`,
    );
  }

  if (decision === "REJECTED") {
    const updated = await prisma.order.update({
      where: { id: order.id },
      data: {
        status: "CANCELLED_MANUAL",
        cancelledAt: new Date(),
        cancelReason: "Rechazado en revisión de riesgo por historial de rechazos",
      },
    });
    await recordHistory(order.id, order.status, "CANCELLED_MANUAL", `admin:${decidedBy}`);
    return updated;
  }

  return applyQuantityFilterAndAdvance(order, `admin:${decidedBy}`);
}

/**
 * Cancela automáticamente los pedidos que nunca confirmaron tras el SMS
 * (sección 2.6). Pensado para correr periódicamente (cron).
 */
export async function cancelExpiredUnconfirmedOrders(): Promise<number> {
  const cutoff = new Date();
  const candidates = await prisma.order.findMany({
    where: {
      status: "PENDING_CONFIRMATION",
      smsSentAt: { not: null },
    },
  });

  let cancelled = 0;
  for (const order of candidates) {
    if (!order.smsSentAt) continue;
    const graceDeadline = new Date(
      order.smsSentAt.getTime() + UNCONFIRMED_CANCEL_GRACE_HOURS * 60 * 60 * 1000,
    );
    if (cutoff < graceDeadline) continue;

    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: "CANCELLED_NOT_CONFIRMED",
        cancelledAt: cutoff,
        cancelReason: "No confirmó tras el SMS",
      },
    });
    await recordHistory(order.id, order.status, "CANCELLED_NOT_CONFIRMED", "cron");
    cancelled++;
  }
  return cancelled;
}

/**
 * Historial de no confirmados (sección 4.1) — "Aprobar e inyectar": el
 * cliente confirmó por otro medio (ej. WhatsApp manual), se reingresa al
 * filtro de cantidad.
 */
export async function approveAndReinject(orderId: string, decidedBy: string): Promise<Order> {
  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
  if (order.status !== "CANCELLED_NOT_CONFIRMED") {
    throw new OrderServiceError(
      `Solo se puede reinyectar un pedido cancelado por no confirmar (estado actual: ${order.status})`,
    );
  }
  return confirmOrder(orderId, "MANUAL", `admin:${decidedBy}`);
}

/**
 * Historial de no confirmados (sección 4.1) — "Eliminar": se borra la fila.
 */
export async function deleteUnconfirmedOrder(orderId: string): Promise<void> {
  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
  if (order.status !== "CANCELLED_NOT_CONFIRMED") {
    throw new OrderServiceError(
      `Solo se puede eliminar un pedido cancelado por no confirmar (estado actual: ${order.status})`,
    );
  }
  await prisma.order.delete({ where: { id: orderId } });
}

/**
 * Decisión humana sobre un pedido en revisión por cantidad (2-3 unidades).
 */
export async function decideQuantityReview(
  orderId: string,
  decision: "APPROVED" | "REJECTED",
  decidedBy: string,
): Promise<Order> {
  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
  if (order.status !== "QUANTITY_REVIEW") {
    throw new OrderServiceError(
      `El pedido ${order.shopifyOrderName} no está en revisión de cantidad (estado actual: ${order.status})`,
    );
  }

  await prisma.order.update({
    where: { id: order.id },
    data: {
      quantityReviewDecision: decision,
      quantityReviewDecidedAt: new Date(),
      quantityReviewDecidedBy: decidedBy,
    },
  });

  if (decision === "REJECTED") {
    const updated = await prisma.order.update({
      where: { id: order.id },
      data: { status: "CANCELLED_MANUAL", cancelledAt: new Date(), cancelReason: "Rechazado en revisión de cantidad" },
    });
    await recordHistory(order.id, order.status, "CANCELLED_MANUAL", `admin:${decidedBy}`);
    return updated;
  }

  return sendToDropiAndAdvance(order, `admin:${decidedBy}`);
}
