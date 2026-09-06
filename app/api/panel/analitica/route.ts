import { prisma } from "@/lib/db";

/**
 * Analítica con datos que sí tenemos (nada de utilidad/costos — no los
 * rastreamos todavía). GET /api/panel/analitica
 */
export async function GET() {
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const orders = await prisma.order.findMany({
    where: { createdAt: { gte: since } },
    select: { createdAt: true, confirmedVia: true, confirmedAt: true },
  });

  const byDay = new Map<string, number>();
  for (const o of orders) {
    const key = o.createdAt.toISOString().slice(0, 10);
    byDay.set(key, (byDay.get(key) ?? 0) + 1);
  }
  const ordersByDay = Array.from(byDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));

  const confirmedByChannel = { EMAIL: 0, SMS: 0, MANUAL: 0 };
  for (const o of orders) {
    if (o.confirmedVia) confirmedByChannel[o.confirmedVia]++;
  }

  const confirmedCount = orders.filter((o) => o.confirmedAt).length;
  const confirmationRate = orders.length > 0 ? Math.round((confirmedCount / orders.length) * 100) : null;

  const falseRejections = await prisma.deliveryIncident.count({ where: { verdict: "REJECTED_FALSE" } });

  return Response.json({
    ok: true,
    ordersByDay,
    confirmedByChannel,
    confirmationRate,
    totalOrders: orders.length,
    falseRejections,
  });
}
