import { prisma } from "@/lib/db";

/**
 * Historial de no confirmados (sección 4.1): pedidos cancelados por no
 * confirmar tras el SMS. GET /api/historial-no-confirmados
 */
export async function GET() {
  const orders = await prisma.order.findMany({
    where: { status: "CANCELLED_NOT_CONFIRMED" },
    orderBy: { cancelledAt: "desc" },
    select: {
      id: true,
      shopifyOrderName: true,
      customerEmail: true,
      customerPhone: true,
      totalQuantity: true,
      cancelledAt: true,
      cancelReason: true,
    },
  });
  return Response.json({ ok: true, orders });
}
