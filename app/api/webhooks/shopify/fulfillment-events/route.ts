import { randomUUID } from "node:crypto";
import { verifyShopifyWebhookHmac } from "@/lib/shopify-webhook-verify";
import { prisma } from "@/lib/db";

/**
 * SOLO CAPTURA — sin lógica de detección todavía. Guarda el payload crudo
 * de cada fulfillment event para poder ver qué manda Dropify realmente
 * (status/message) antes de construir la clasificación de "entrega
 * cuestionada" (sección 6 del spec). Revisar FulfillmentEventLog en la base
 * una vez que un pedido real tenga movimiento de transportadora.
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

  // Extracción defensiva: no sabemos aún la forma exacta que manda Dropify/Shopify.
  const shopifyFulfillmentEventId =
    (payload.admin_graphql_api_id as string | undefined) ??
    (payload.id !== undefined ? `legacy:${payload.id}` : `unknown:${randomUUID()}`);

  await prisma.fulfillmentEventLog.upsert({
    where: { shopifyFulfillmentEventId },
    create: {
      shopifyFulfillmentEventId,
      shopifyFulfillmentId: (payload.fulfillment_id as string | number | undefined)?.toString(),
      shopifyOrderId: (payload.order_id as string | number | undefined)?.toString(),
      status: payload.status as string | undefined,
      message: payload.message as string | undefined,
      rawPayload: rawBody,
    },
    update: {}, // idempotente: si Shopify reintenta, no duplicamos
  });

  return Response.json({ ok: true });
}
