import { prisma } from "@/lib/db";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * Desbloquea una zona/transportadora (ej. cuando se resuelve el problema
 * con la transportadora). No borra el registro — queda como historial.
 * POST /api/zonas-bloqueadas/[id]/desbloquear { reactivatedBy }
 */
export async function POST(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const reactivatedBy = typeof body?.reactivatedBy === "string" ? body.reactivatedBy : "desconocido";

  const zone = await prisma.blockedZone.update({
    where: { id },
    data: { active: false, reactivatedAt: new Date(), reactivatedBy },
  });

  return Response.json({ ok: true, zone });
}
