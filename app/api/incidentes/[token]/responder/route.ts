import { getIncidentByToken, recordSurveyResponse } from "@/lib/incidents";
import type { DeliveryIncidentSurveyAnswer } from "@prisma/client";

type RouteParams = { params: Promise<{ token: string }> };

const VALID_ANSWERS: DeliveryIncidentSurveyAnswer[] = ["NOBODY_CAME", "DELIVERED_BUT_REFUSED", "OTHER"];

export async function POST(request: Request, { params }: RouteParams) {
  const { token } = await params;
  const body = await request.json().catch(() => ({}));
  const answer = body?.answer as DeliveryIncidentSurveyAnswer | undefined;
  const comment = typeof body?.comment === "string" ? body.comment : null;

  if (!answer || !VALID_ANSWERS.includes(answer)) {
    return Response.json({ ok: false, error: "Respuesta inválida" }, { status: 400 });
  }

  const incident = await getIncidentByToken(token);
  if (!incident) {
    return Response.json({ ok: false, error: "Enlace inválido" }, { status: 404 });
  }
  if (incident.surveyRespondedAt) {
    return Response.json({ ok: false, error: "Este incidente ya fue respondido" }, { status: 409 });
  }

  const updated = await recordSurveyResponse(token, answer, comment);
  return Response.json({ ok: true, verdict: updated.verdict });
}
