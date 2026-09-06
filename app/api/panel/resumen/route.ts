import { prisma } from "@/lib/db";
import { getExceptionsInbox } from "@/lib/exceptions";

/**
 * KPIs reales para la página de Inicio del panel. Solo métricas que
 * podemos calcular con datos que de verdad tenemos (nada de utilidad o
 * costos, no los rastreamos).
 * GET /api/panel/resumen
 */
export async function GET() {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [ordersToday, confirmedOrLater, totalRecent, sentToDropiToday, exceptions] = await Promise.all([
    prisma.order.count({ where: { createdAt: { gte: startOfToday } } }),
    prisma.order.count({
      where: {
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        confirmedAt: { not: null },
      },
    }),
    prisma.order.count({ where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } }),
    prisma.order.count({ where: { markedPaidAt: { gte: startOfToday } } }),
    getExceptionsInbox(),
  ]);

  const confirmationRate = totalRecent > 0 ? Math.round((confirmedOrLater / totalRecent) * 100) : null;

  return Response.json({
    ok: true,
    ordersToday,
    exceptionsCount: exceptions.length,
    confirmationRate,
    sentToDropiToday,
  });
}
