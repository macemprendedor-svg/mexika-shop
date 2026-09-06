import { processPendingIncidentSurveys } from "@/lib/incidents";

/**
 * Disparador periódico (cron): escala a SMS los incidentes sin respuesta
 * tras 3h, y cancela el pedido si pasan 24h sin respuesta desde el correo.
 * Protegido con CRON_SECRET, igual que /api/cron/process-confirmations.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (secret && authHeader !== `Bearer ${secret}`) {
    return Response.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }

  const result = await processPendingIncidentSurveys();
  return Response.json({ ok: true, ...result });
}
