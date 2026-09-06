import { sendEmail } from "@/lib/mailer";
import type { DeliveryIncident, Order } from "@prisma/client";

/**
 * Reporte de evidencia a Dropi cuando un incidente se confirma como
 * rechazo falso (sección "Reporte automático a Dropi" del documento de
 * detección). Requiere DROPI_SOPORTE_EMAIL.
 */
export async function reportIncidentToDropi(
  incident: DeliveryIncident,
  order: Order,
): Promise<void> {
  const dropiEmail = process.env.DROPI_SOPORTE_EMAIL;
  if (!dropiEmail) {
    throw new Error("Falta DROPI_SOPORTE_EMAIL en las variables de entorno");
  }

  const html = `
    <h2>Reporte de posible falso rechazo de entrega</h2>
    <p><strong>Pedido:</strong> ${order.shopifyOrderName}</p>
    <p><strong>Guía:</strong> ${incident.trackingNumber ?? "N/D"}</p>
    <p><strong>Transportadora:</strong> ${incident.carrierName ?? "N/D"}</p>
    <p><strong>Código postal:</strong> ${incident.postalCode} — ${incident.municipality ?? ""}</p>
    <p><strong>Estatus reportado por la transportadora:</strong> ${incident.rawStatus ?? ""} — ${incident.rawMessage ?? ""}</p>
    <p><strong>Respuesta del cliente a la encuesta:</strong> nadie llegó ni llamó a su domicilio.</p>
    <p><strong>Encuesta enviada:</strong> correo el ${incident.emailSentAt?.toISOString() ?? "N/D"}${
      incident.smsSentAt ? `, SMS el ${incident.smsSentAt.toISOString()}` : ""
    }</p>
    <p><strong>Respondida:</strong> ${incident.surveyRespondedAt?.toISOString() ?? "N/D"}</p>
    <p>Se solicita revisión del caso con la transportadora ${incident.carrierName ?? ""}.</p>
  `;

  await sendEmail({
    to: dropiEmail,
    subject: `Reporte de rechazo falso — guía ${incident.trackingNumber ?? incident.id}`,
    html,
  });
}
