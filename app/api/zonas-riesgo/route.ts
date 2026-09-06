import { prisma } from "@/lib/db";

/**
 * Ranking de CP/transportadora por rechazos falsos (para la futura pestaña
 * "Zonas de riesgo" del panel). Por ahora solo el backend — no calculamos
 * "tasa de rechazo %" porque eso requeriría contar también los pedidos
 * entregados sin incidente, dato que todavía no capturamos por CP+transportadora.
 * GET /api/zonas-riesgo
 */
export async function GET() {
  const rows = await prisma.deliveryIncident.groupBy({
    by: ["postalCode", "municipality", "carrierName"],
    where: { verdict: { not: null } },
    _count: { _all: true },
  });

  const withFalseRejections = await prisma.deliveryIncident.groupBy({
    by: ["postalCode", "carrierName"],
    where: { verdict: "REJECTED_FALSE" },
    _count: { _all: true },
  });

  const falseCountByKey = new Map(
    withFalseRejections.map((r) => [`${r.postalCode}|${r.carrierName}`, r._count._all]),
  );

  const ranking = rows
    .map((r) => ({
      postalCode: r.postalCode,
      municipality: r.municipality,
      carrierName: r.carrierName,
      totalIncidents: r._count._all,
      falseRejections: falseCountByKey.get(`${r.postalCode}|${r.carrierName}`) ?? 0,
    }))
    .sort((a, b) => b.falseRejections - a.falseRejections);

  return Response.json({ ok: true, ranking });
}
