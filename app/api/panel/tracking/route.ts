import { prisma } from "@/lib/db";

/**
 * Centro de tracking simplificado: todavía no tenemos datos granulares
 * reales de transportadora (fulfillment events capturados = 0 hasta que
 * un pedido real avance con Dropi). Muestra lo que sí existe: pedidos en
 * Dropi, eventos crudos capturados, e incidentes de entrega abiertos.
 * GET /api/panel/tracking
 */
export async function GET() {
  const [inTransit, rawEvents, openIncidents] = await Promise.all([
    prisma.order.findMany({
      where: { status: "SENT_TO_DROPI" },
      orderBy: { markedPaidAt: "desc" },
      select: { id: true, shopifyOrderName: true, markedPaidAt: true },
    }),
    prisma.fulfillmentEventLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, status: true, message: true, shopifyOrderId: true, createdAt: true },
    }),
    prisma.deliveryIncident.findMany({
      where: { surveyRespondedAt: null },
      orderBy: { createdAt: "desc" },
      include: { order: { select: { shopifyOrderName: true } } },
    }),
  ]);

  return Response.json({ ok: true, inTransit, rawEvents, openIncidents });
}
