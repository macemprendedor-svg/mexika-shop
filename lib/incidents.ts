import { prisma } from "@/lib/db";
import { sendEmail, MailerError } from "@/lib/mailer";
import { sendSms, SmsError } from "@/lib/sms";
import { checkAndApplyZoneBlock } from "@/lib/zone-block";
import { reportIncidentToDropi } from "@/lib/dropi-report";
import type { DeliveryIncident, DeliveryIncidentSurveyAnswer } from "@prisma/client";

// Sección "Cron: escalación a SMS y cancelación automática" del documento.
const HOURS_BEFORE_SMS = 3;
const HOURS_BEFORE_CANCEL = 24; // contadas desde el correo inicial

function surveyUrl(token: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${base}/incidente/${token}`;
}

export async function getIncidentByToken(token: string): Promise<DeliveryIncident | null> {
  return prisma.deliveryIncident.findUnique({ where: { surveyToken: token } });
}

/**
 * Correo inicial de la encuesta ("¿Todo bien con tu pedido?"). Un fallo acá
 * se ignora silenciosamente a nivel de negocio (igual que en el motor de
 * confirmación) — no debe tumbar la creación del incidente.
 */
export async function sendSurveyEmailIfNeeded(incident: DeliveryIncident): Promise<void> {
  if (incident.emailSentAt || !incident.customerEmail) return;

  const link = surveyUrl(incident.surveyToken);
  try {
    await sendEmail({
      to: incident.customerEmail,
      subject: "¿Todo bien con tu pedido?",
      html: `
        <p>Hola,</p>
        <p>${incident.carrierName ?? "La transportadora"} nos reporta que hoy visitó tu domicilio para
        entregar tu pedido y no fue posible completarlo.</p>
        <p>Si esto no fue así, cuéntanos qué pasó — toma 10 segundos:</p>
        <p><a href="${link}">Contar qué pasó</a></p>
        <p>Si no tenemos noticias tuyas en las próximas 24 horas, tu pedido quedará cancelado automáticamente.</p>
      `,
    });
    await prisma.deliveryIncident.update({
      where: { id: incident.id },
      data: { emailSentAt: new Date() },
    });
  } catch (error) {
    if (!(error instanceof MailerError)) throw error;
  }
}

async function sendSurveySmsIfDue(incident: DeliveryIncident, now: Date): Promise<void> {
  if (incident.smsSentAt || !incident.customerPhone || !incident.emailSentAt) return;
  const hoursSinceEmail = (now.getTime() - incident.emailSentAt.getTime()) / 3_600_000;
  if (hoursSinceEmail < HOURS_BEFORE_SMS) return;

  const link = surveyUrl(incident.surveyToken);
  try {
    await sendSms({
      to: incident.customerPhone,
      body: `Nos reportan que no pudimos entregarte tu pedido hoy. Cuéntanos qué pasó: ${link} Sin respuesta, se cancela.`,
    });
    await prisma.deliveryIncident.update({
      where: { id: incident.id },
      data: { smsSentAt: now },
    });
  } catch (error) {
    if (!(error instanceof SmsError)) throw error;
  }
}

/**
 * "otro" no se autoclasifica — queda para revisión manual (sin veredicto).
 */
function verdictForAnswer(
  answer: DeliveryIncidentSurveyAnswer,
): "REJECTED_FALSE" | "REJECTED_BY_CUSTOMER" | null {
  if (answer === "NOBODY_CAME") return "REJECTED_FALSE";
  if (answer === "DELIVERED_BUT_REFUSED") return "REJECTED_BY_CUSTOMER";
  return null;
}

export async function recordSurveyResponse(
  token: string,
  answer: DeliveryIncidentSurveyAnswer,
  comment: string | null,
): Promise<DeliveryIncident> {
  const incident = await prisma.deliveryIncident.findUniqueOrThrow({
    where: { surveyToken: token },
  });

  const verdict = verdictForAnswer(answer);

  const updated = await prisma.deliveryIncident.update({
    where: { id: incident.id },
    data: {
      surveyAnswer: answer,
      surveyComment: comment,
      surveyRespondedAt: new Date(),
      verdict,
    },
  });

  if (verdict === "REJECTED_FALSE") {
    await checkAndApplyZoneBlock(updated);
    const order = await prisma.order.findUniqueOrThrow({ where: { id: updated.orderId } });
    try {
      await reportIncidentToDropi(updated, order);
      await prisma.deliveryIncident.update({
        where: { id: updated.id },
        data: { reportedToDropiAt: new Date() },
      });
    } catch {
      // No debe tumbar el registro del veredicto ni el bloqueo de zona (eso
      // ya se aplicó arriba); si falla el correo a Dropi, queda
      // reportedToDropiAt en null para poder reintentar después.
    }
  }

  return updated;
}

export type ProcessIncidentSurveysResult = {
  smsEscalated: number;
  cancelledNoResponse: number;
};

/**
 * Pasada del cron: escala a SMS los incidentes sin respuesta tras 3h, y
 * cancela el pedido si tras 24h desde el correo sigue sin respuesta. Un
 * `cancelado_sin_respuesta` NO cuenta para el umbral de bloqueo de zona —
 * no hay evidencia de que la transportadora haya mentido.
 */
export async function processPendingIncidentSurveys(): Promise<ProcessIncidentSurveysResult> {
  const now = new Date();

  const pending = await prisma.deliveryIncident.findMany({
    where: { surveyRespondedAt: null, emailSentAt: { not: null } },
  });

  let smsEscalated = 0;
  let cancelledNoResponse = 0;

  for (const incident of pending) {
    if (!incident.smsSentAt) {
      const before = incident.smsSentAt;
      await sendSurveySmsIfDue(incident, now);
      const refreshed = await prisma.deliveryIncident.findUniqueOrThrow({
        where: { id: incident.id },
      });
      if (refreshed.smsSentAt !== before) smsEscalated++;
    }

    const hoursSinceEmail = (now.getTime() - incident.emailSentAt!.getTime()) / 3_600_000;
    if (hoursSinceEmail >= HOURS_BEFORE_CANCEL) {
      await prisma.deliveryIncident.update({
        where: { id: incident.id },
        data: { verdict: "CANCELLED_NO_RESPONSE" },
      });
      await prisma.order.update({
        where: { id: incident.orderId },
        data: {
          status: "CANCELLED_DELIVERY_INCIDENT",
          cancelledAt: now,
          cancelReason: "No respondió la encuesta de entrega cuestionada",
        },
      });
      cancelledNoResponse++;
    }
  }

  return { smsEscalated, cancelledNoResponse };
}
