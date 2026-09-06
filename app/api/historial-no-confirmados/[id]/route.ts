import {
  approveAndReinject,
  deleteUnconfirmedOrder,
  OrderServiceError,
} from "@/lib/orders";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * Historial de no confirmados (sección 4.1): "Aprobar e inyectar" o
 * "Eliminar" sobre un pedido cancelado por no confirmar.
 */
export async function POST(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const action = body?.action as "approve-inject" | "delete" | undefined;
  const decidedBy = typeof body?.decidedBy === "string" ? body.decidedBy : "desconocido";

  try {
    if (action === "approve-inject") {
      const order = await approveAndReinject(id, decidedBy);
      return Response.json({ ok: true, status: order.status });
    }
    if (action === "delete") {
      await deleteUnconfirmedOrder(id);
      return Response.json({ ok: true, deleted: true });
    }
    return Response.json(
      { ok: false, error: "action debe ser approve-inject o delete" },
      { status: 400 },
    );
  } catch (error) {
    if (error instanceof OrderServiceError) {
      return Response.json({ ok: false, error: error.message }, { status: 409 });
    }
    throw error;
  }
}
