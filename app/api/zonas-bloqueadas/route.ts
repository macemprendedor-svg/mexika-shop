import { prisma } from "@/lib/db";

/**
 * GET: lista los bloqueos activos.
 * POST: bloqueo manual desde el panel (sin autenticación todavía — mismo
 * nivel de protección, o falta de ella, que el resto de las rutas admin
 * de este proyecto en Fase 1).
 */
export async function GET() {
  const zones = await prisma.blockedZone.findMany({
    where: { active: true },
    orderBy: { createdAt: "desc" },
  });
  return Response.json({ ok: true, zones });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { postalCode, municipality, carrierName, reason, decidedBy } = body ?? {};

  if (!reason) {
    return Response.json({ ok: false, error: "Falta 'reason'" }, { status: 400 });
  }
  if (!postalCode && !carrierName) {
    return Response.json(
      { ok: false, error: "Debe especificar al menos postalCode o carrierName" },
      { status: 400 },
    );
  }

  const zone = await prisma.blockedZone.create({
    data: {
      postalCode: postalCode ?? null,
      municipality: municipality ?? null,
      carrierName: carrierName ?? null,
      reason: `${reason} (bloqueo manual${decidedBy ? ` por ${decidedBy}` : ""})`,
      incidentsReference: 0,
    },
  });

  return Response.json({ ok: true, zone });
}
