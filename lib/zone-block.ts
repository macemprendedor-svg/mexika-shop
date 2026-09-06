import { prisma } from "@/lib/db";
import { sendTelegramAlert, TelegramError } from "@/lib/telegram";
import type { DeliveryIncident } from "@prisma/client";

// Umbrales (sección "Registro de cambios" del documento de detección de
// rechazos falsos): por combo cp+transportadora, más de 3; por
// transportadora sola repartida en ≥2 CPs distintos, más de 10 (más
// tolerancia porque una transportadora grande opera en muchas zonas).
const COMBO_THRESHOLD = 3;
const CARRIER_THRESHOLD = 10;
const CARRIER_MIN_DISTINCT_POSTAL_CODES = 2;

/**
 * Tras marcar un incidente como REJECTED_FALSE, revisa si se cruzó algún
 * umbral y, de ser así, inserta el bloqueo (si no existe ya uno activo) y
 * avisa por Telegram. No hace nada si el veredicto no es REJECTED_FALSE.
 */
export async function checkAndApplyZoneBlock(incident: DeliveryIncident): Promise<void> {
  if (incident.verdict !== "REJECTED_FALSE" || !incident.carrierName) return;

  await checkComboThreshold(incident.postalCode, incident.carrierName, incident.municipality);
  await checkCarrierThreshold(incident.carrierName);
}

async function checkComboThreshold(
  postalCode: string,
  carrierName: string,
  municipality: string | null,
): Promise<void> {
  const count = await prisma.deliveryIncident.count({
    where: { postalCode, carrierName, verdict: "REJECTED_FALSE" },
  });
  if (count <= COMBO_THRESHOLD) return;

  const alreadyBlocked = await prisma.blockedZone.findFirst({
    where: { postalCode, carrierName, active: true },
  });
  if (alreadyBlocked) return;

  await prisma.blockedZone.create({
    data: {
      postalCode,
      carrierName,
      municipality,
      reason: `Bloqueo automático de zona: ${count} rechazos falsos comprobados`,
      incidentsReference: count,
    },
  });

  await notify(
    `⚠️ CP ${postalCode} + ${carrierName} bloqueados — ${count} rechazos falsos comprobados.`,
  );
}

async function checkCarrierThreshold(carrierName: string): Promise<void> {
  const incidents = await prisma.deliveryIncident.findMany({
    where: { carrierName, verdict: "REJECTED_FALSE" },
    select: { postalCode: true },
  });
  const distinctPostalCodes = new Set(incidents.map((i) => i.postalCode)).size;

  if (incidents.length <= CARRIER_THRESHOLD || distinctPostalCodes < CARRIER_MIN_DISTINCT_POSTAL_CODES) {
    return;
  }

  const alreadyBlocked = await prisma.blockedZone.findFirst({
    where: { postalCode: null, carrierName, active: true },
  });
  if (alreadyBlocked) return;

  await prisma.blockedZone.create({
    data: {
      postalCode: null,
      carrierName,
      reason: `Bloqueo automático de transportadora: ${incidents.length} rechazos falsos en ${distinctPostalCodes} códigos postales distintos`,
      incidentsReference: incidents.length,
    },
  });

  await notify(
    `🚨 ${carrierName} bloqueada en TODO el sistema — ${incidents.length} rechazos falsos en ${distinctPostalCodes} CPs. Revisa si amerita hablar directo con Dropi.`,
  );
}

async function notify(text: string): Promise<void> {
  try {
    await sendTelegramAlert(text);
  } catch (error) {
    // No queremos que un fallo de Telegram tumbe el flujo de bloqueo en sí.
    if (!(error instanceof TelegramError)) throw error;
  }
}

/**
 * Gate antes de orderMarkAsPaid. `carrierName` normalmente no se conoce
 * todavía en ese punto (Dropi asigna transportadora después de recibir el
 * pedido) — se puede omitir y solo se evalúan los bloqueos de CP puro
 * (carrierName null en la fila de BlockedZone).
 */
export async function isZoneBlocked(
  postalCode: string,
  carrierName?: string,
): Promise<{ id: string; reason: string } | null> {
  const match = await prisma.blockedZone.findFirst({
    where: {
      active: true,
      AND: [
        { OR: [{ postalCode }, { postalCode: null }] },
        carrierName
          ? { OR: [{ carrierName }, { carrierName: null }] }
          : { carrierName: null },
      ],
    },
  });
  return match ? { id: match.id, reason: match.reason } : null;
}
