import { prisma } from "@/lib/db";
import { shopifyGraphql } from "@/lib/shopify";
import { sendTelegramAlert, TelegramError } from "@/lib/telegram";
import type { OrderStatus } from "@prisma/client";

/**
 * Reconciliación (sección 5): no podemos comparar contra Dropi (sin API
 * REST), así que reconciliamos nuestra base contra el estado real en
 * Shopify — para detectar pedidos que quedaron desincronizados (ej.
 * marcados SENT_TO_DROPI pero Shopify ya no los muestra como pagados, o
 * cancelados en Shopify sin que nuestro sistema se enterara).
 */

const NON_TERMINAL_STATUSES: OrderStatus[] = [
  "PENDING_CONFIRMATION",
  "CONFIRMED",
  "QUANTITY_REVIEW",
  "PAUSED_ZONE_BLOCKED",
  "SENT_TO_DROPI",
];

const ORDER_STATE_QUERY = /* GraphQL */ `
  query OrderState($id: ID!) {
    order(id: $id) {
      id
      displayFinancialStatus
      cancelledAt
    }
  }
`;

type OrderStateResponse = {
  order: { id: string; displayFinancialStatus: string; cancelledAt: string | null } | null;
};

export type ReconciliationDrift = {
  orderId: string;
  orderName: string;
  ourStatus: OrderStatus;
  shopifyFinancialStatus: string | null;
  shopifyCancelledAt: string | null;
  note: string;
};

export function detectDrift(
  ourStatus: OrderStatus,
  shopifyFinancialStatus: string,
  shopifyCancelledAt: string | null,
): string | null {
  if (shopifyCancelledAt && ourStatus !== "PAUSED_ZONE_BLOCKED") {
    return "El pedido está cancelado en Shopify pero no lo reflejamos así aquí";
  }
  if (ourStatus === "SENT_TO_DROPI" && shopifyFinancialStatus !== "PAID") {
    return `Marcado como enviado a Dropi pero Shopify muestra financial_status=${shopifyFinancialStatus}`;
  }
  if (
    ["PENDING_CONFIRMATION", "CONFIRMED", "QUANTITY_REVIEW", "PAUSED_ZONE_BLOCKED"].includes(ourStatus) &&
    shopifyFinancialStatus === "PAID"
  ) {
    return "Shopify ya lo muestra como pagado, pero aquí sigue sin enviarse a Dropi";
  }
  return null;
}

export async function reconcileOrders(): Promise<ReconciliationDrift[]> {
  const candidates = await prisma.order.findMany({
    where: { status: { in: NON_TERMINAL_STATUSES } },
  });

  const drifts: ReconciliationDrift[] = [];

  for (const order of candidates) {
    let data: OrderStateResponse;
    try {
      data = await shopifyGraphql<OrderStateResponse>(ORDER_STATE_QUERY, { id: order.shopifyOrderId });
    } catch {
      continue; // error puntual de red/API — no lo contamos como drift
    }
    if (!data.order) continue;

    const note = detectDrift(order.status, data.order.displayFinancialStatus, data.order.cancelledAt);
    if (!note) continue;

    drifts.push({
      orderId: order.id,
      orderName: order.shopifyOrderName,
      ourStatus: order.status,
      shopifyFinancialStatus: data.order.displayFinancialStatus,
      shopifyCancelledAt: data.order.cancelledAt,
      note,
    });

    await prisma.orderStatusHistory.create({
      data: {
        orderId: order.id,
        previousStatus: order.status,
        newStatus: order.status,
        source: "cron:reconciliation",
        note: `Desincronización detectada: ${note}`,
      },
    });
  }

  if (drifts.length > 0) {
    const lines = drifts.map((d) => `• ${d.orderName}: ${d.note}`).join("\n");
    try {
      await sendTelegramAlert(`⚠️ Reconciliación encontró ${drifts.length} pedido(s) desincronizado(s):\n${lines}`);
    } catch (error) {
      if (!(error instanceof TelegramError)) throw error;
    }
  }

  return drifts;
}
