import { prisma } from "@/lib/db";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * Detalle de un pedido + su historial de cambios, para el panel de detalle
 * de la bandeja de excepciones.
 * GET /api/pedidos/[id]
 */
export async function GET(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    include: { statusHistory: { orderBy: { createdAt: "asc" } } },
  });

  if (!order) {
    return Response.json({ ok: false, error: "Pedido no encontrado" }, { status: 404 });
  }

  return Response.json({ ok: true, order });
}
