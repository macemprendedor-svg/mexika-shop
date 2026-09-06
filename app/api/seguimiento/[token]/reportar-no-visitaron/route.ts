import { prisma } from "@/lib/db";
import { createIncidentFromCustomerReport } from "@/lib/incidents";

type RouteParams = { params: Promise<{ token: string }> };

/**
 * Versión web (sin Telegram) del botón "Reportar que no visitaron mi
 * domicilio" — mismo efecto que el botón de Telegram (sección 8).
 */
export async function POST(_request: Request, { params }: RouteParams) {
  const { token } = await params;
  const order = await prisma.order.findUnique({ where: { confirmationToken: token } });
  if (!order) {
    return Response.json({ ok: false, error: "Enlace inválido" }, { status: 404 });
  }

  await createIncidentFromCustomerReport(order.id);
  return Response.json({ ok: true });
}
