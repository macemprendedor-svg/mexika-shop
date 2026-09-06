import { decideCustomerRiskReview, OrderServiceError } from "@/lib/orders";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * Decisión humana sobre un pedido en revisión por historial de rechazos
 * del cliente (sección 4.2).
 */
export async function POST(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const decision = body?.decision as "APPROVED" | "REJECTED" | undefined;
  const decidedBy = typeof body?.decidedBy === "string" ? body.decidedBy : "desconocido";

  if (decision !== "APPROVED" && decision !== "REJECTED") {
    return Response.json(
      { ok: false, error: "decision debe ser APPROVED o REJECTED" },
      { status: 400 },
    );
  }

  try {
    const order = await decideCustomerRiskReview(id, decision, decidedBy);
    return Response.json({ ok: true, status: order.status });
  } catch (error) {
    if (error instanceof OrderServiceError) {
      return Response.json({ ok: false, error: error.message }, { status: 409 });
    }
    throw error;
  }
}
