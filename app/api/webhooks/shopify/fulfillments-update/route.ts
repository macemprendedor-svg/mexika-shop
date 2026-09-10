import { randomUUID } from "node:crypto";
import { verifyShopifyWebhookHmac } from "@/lib/shopify-webhook-verify";
import { prisma } from "@/lib/db";

/**
 * SOLO CAPTURA — igual que fulfillment-events/route.ts, pero para el topic
 * fulfillments/update (dispara en cada cambio de estatus de un Fulfillment,
 * ej. cuando Dropi/Dropify actualiza el tracking). El payload es el objeto
 * Fulfillment completo, no un FulfillmentEvent individual, así que no hay un
 * id de "evento" real que sirva de clave de idempotencia — por eso aquí se
 * inserta una fila nueva por cada entrega del webhook (en vez de upsert),
 * para poder ver con qué frecuencia y en qué forma llegan estas
 * actualizaciones antes de decidir la arquitectura del tracking de pago
 * anticipado.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const hmacHeader = request.headers.get("X-Shopify-Hmac-Sha256");

  let isValid: boolean;
  try {
    isValid = verifyShopifyWebhookHmac(rawBody, hmacHeader);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }

  if (!isValid) {
    return Response.json({ ok: false, error: "Firma HMAC inválida" }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return Response.json({ ok: false, error: "Body no es JSON válido" }, { status: 400 });
  }

  // Extracción defensiva: no sabemos aún la forma exacta que manda Shopify
  // para este topic (mismo enfoque que fulfillment-events/route.ts).
  const fulfillmentGid =
    (payload.admin_graphql_api_id as string | undefined) ??
    (payload.id !== undefined ? `legacy:${payload.id}` : undefined);

  const status =
    (payload.shipment_status as string | undefined) ?? (payload.status as string | undefined);

  const trackingNumber = payload.tracking_number as string | undefined;
  const trackingCompany = payload.tracking_company as string | undefined;
  const message = trackingNumber
    ? `tracking_number=${trackingNumber} tracking_company=${trackingCompany ?? ""}`
    : undefined;

  await prisma.fulfillmentEventLog.create({
    data: {
      shopifyFulfillmentEventId: `${fulfillmentGid ?? `unknown:${randomUUID()}`}:${randomUUID()}`,
      shopifyFulfillmentId: fulfillmentGid,
      shopifyOrderId: (payload.order_id as string | number | undefined)?.toString(),
      status,
      message,
      rawPayload: rawBody,
    },
  });

  return Response.json({ ok: true });
}
