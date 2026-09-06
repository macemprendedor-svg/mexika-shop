import { prisma } from "@/lib/db";
import { sendToDropiAndAdvance, OrderServiceError } from "@/lib/orders";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * Reintenta el envío a Dropi de un pedido que quedó CONFIRMED sin avanzar
 * (sección 7: "pedido confirmado que no llegó a Dropi").
 * POST /api/pedidos/[id]/reintentar-dropi
 */
export async function POST(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const decidedBy = typeof body?.decidedBy === "string" ? body.decidedBy : "desconocido";

  const order = await prisma.order.findUniqueOrThrow({ where: { id } });
  if (order.status !== "CONFIRMED") {
    return Response.json(
      { ok: false, error: `El pedido no está en estado CONFIRMED (actual: ${order.status})` },
      { status: 409 },
    );
  }

  try {
    const updated = await sendToDropiAndAdvance(order, `admin:${decidedBy}`);
    return Response.json({ ok: true, status: updated.status });
  } catch (error) {
    if (error instanceof OrderServiceError) {
      return Response.json({ ok: false, error: error.message }, { status: 409 });
    }
    throw error;
  }
}
