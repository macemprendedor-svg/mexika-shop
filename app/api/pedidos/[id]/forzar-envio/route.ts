import { prisma } from "@/lib/db";
import { sendToDropiAndAdvance, OrderServiceError } from "@/lib/orders";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * Fuerza el envío a Dropi de un pedido pausado por zona bloqueada, cuando
 * un humano decide arriesgar de todos modos (sección 4.2: "el humano decide
 * si arriesga y avanza el nuevo pedido, o lo corta").
 * POST /api/pedidos/[id]/forzar-envio
 */
export async function POST(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const decidedBy = typeof body?.decidedBy === "string" ? body.decidedBy : "desconocido";

  const order = await prisma.order.findUniqueOrThrow({ where: { id } });
  if (order.status !== "PAUSED_ZONE_BLOCKED") {
    return Response.json(
      { ok: false, error: `El pedido no está pausado por zona bloqueada (actual: ${order.status})` },
      { status: 409 },
    );
  }

  try {
    const updated = await sendToDropiAndAdvance(order, `admin:${decidedBy}`, { bypassZoneGate: true });
    return Response.json({ ok: true, status: updated.status });
  } catch (error) {
    if (error instanceof OrderServiceError) {
      return Response.json({ ok: false, error: error.message }, { status: 409 });
    }
    throw error;
  }
}
