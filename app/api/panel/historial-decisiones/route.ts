import { prisma } from "@/lib/db";

/**
 * Historial de decisiones humanas (sección 4.2: "esa decisión y el
 * historial se conservan permanentemente") — cualquier cambio de estado
 * cuyo origen fue una persona desde el panel, no el sistema automático.
 * GET /api/panel/historial-decisiones
 */
export async function GET() {
  const entries = await prisma.orderStatusHistory.findMany({
    where: { source: { startsWith: "admin:" } },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { order: { select: { shopifyOrderName: true } } },
  });

  return Response.json({ ok: true, entries });
}
