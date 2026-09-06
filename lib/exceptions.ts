import { prisma } from "@/lib/db";

// Cuánto tiempo sin avanzar antes de considerar "atorado" un pedido
// confirmado que no llegó a Dropi (sección 7: alerta correspondiente).
const CONFIRMED_STUCK_MINUTES = 10;

export type ExceptionSeverity = "red" | "yellow";

export type ExceptionItem = {
  orderId: string;
  orderName: string;
  category:
    | "QUANTITY_REVIEW"
    | "ZONE_BLOCKED"
    | "STUCK_BEFORE_DROPI"
    | "UNCONFIRMED_HISTORY";
  reason: string;
  recommendedAction: string;
  ageMinutes: number;
  severity: ExceptionSeverity;
};

function ageMinutes(date: Date): number {
  return Math.round((Date.now() - date.getTime()) / 60_000);
}

/**
 * Bandeja única de excepciones (sección 5 del spec): qué pedido necesita
 * acción humana, por qué, y cuál es la siguiente acción recomendada.
 * Ordenada por antigüedad descendente (lo más viejo primero).
 */
export async function getExceptionsInbox(): Promise<ExceptionItem[]> {
  const items: ExceptionItem[] = [];

  const quantityReview = await prisma.order.findMany({
    where: { status: "QUANTITY_REVIEW" },
    orderBy: { confirmedAt: "asc" },
  });
  for (const order of quantityReview) {
    const age = ageMinutes(order.confirmedAt ?? order.createdAt);
    items.push({
      orderId: order.id,
      orderName: order.shopifyOrderName,
      category: "QUANTITY_REVIEW",
      reason: `${order.totalQuantity} unidades — requiere revisión humana antes de Dropi`,
      recommendedAction: "Aprobar o rechazar en /api/pedidos/[id]/revision-cantidad",
      ageMinutes: age,
      severity: age > 60 ? "red" : "yellow",
    });
  }

  const zoneBlocked = await prisma.order.findMany({
    where: { status: "PAUSED_ZONE_BLOCKED" },
    orderBy: { updatedAt: "asc" },
  });
  for (const order of zoneBlocked) {
    const age = ageMinutes(order.updatedAt);
    items.push({
      orderId: order.id,
      orderName: order.shopifyOrderName,
      category: "ZONE_BLOCKED",
      reason: "La zona de entrega está bloqueada por rechazos falsos previos",
      recommendedAction: "Revisar en /panel (Zonas bloqueadas) o forzar envío si se decide arriesgar",
      ageMinutes: age,
      severity: "yellow",
    });
  }

  const stuckConfirmed = await prisma.order.findMany({
    where: {
      status: "CONFIRMED",
      confirmedAt: { lt: new Date(Date.now() - CONFIRMED_STUCK_MINUTES * 60_000) },
    },
    orderBy: { confirmedAt: "asc" },
  });
  for (const order of stuckConfirmed) {
    const age = ageMinutes(order.confirmedAt!);
    items.push({
      orderId: order.id,
      orderName: order.shopifyOrderName,
      category: "STUCK_BEFORE_DROPI",
      reason: "Confirmado pero no logró enviarse a Dropi (revisar historial del pedido)",
      recommendedAction: "Reintentar en /api/pedidos/[id]/reintentar-dropi",
      ageMinutes: age,
      severity: "red",
    });
  }

  const unconfirmedHistory = await prisma.order.findMany({
    where: { status: "CANCELLED_NOT_CONFIRMED" },
    orderBy: { cancelledAt: "asc" },
  });
  for (const order of unconfirmedHistory) {
    const age = ageMinutes(order.cancelledAt ?? order.createdAt);
    items.push({
      orderId: order.id,
      orderName: order.shopifyOrderName,
      category: "UNCONFIRMED_HISTORY",
      reason: "El cliente nunca confirmó tras el SMS",
      recommendedAction: "Aprobar e inyectar (si confirmó por otro medio) o eliminar",
      ageMinutes: age,
      severity: "yellow",
    });
  }

  return items.sort((a, b) => b.ageMinutes - a.ageMinutes);
}
