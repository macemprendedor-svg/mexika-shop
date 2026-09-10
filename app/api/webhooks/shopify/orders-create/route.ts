import { verifyShopifyWebhookHmac } from "@/lib/shopify-webhook-verify";
import {
  createOrderFromShopifyWebhook,
  isPrepaidOrder,
  type ShopifyOrderWebhookPayload,
} from "@/lib/orders";
import { sendEmail1IfNeeded } from "@/lib/confirmation-engine";

/**
 * Recibe el webhook orders/create de Shopify: captura el pedido (Fase 1,
 * "captura del pedido, pausa") y lo deja en PENDING_CONFIRMATION.
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

  let payload: ShopifyOrderWebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return Response.json({ ok: false, error: "Body no es JSON válido" }, { status: 400 });
  }

  // Pedido de pago anticipado con Mercado Pago: lo maneja un proyecto aparte,
  // no debe entrar a la lógica de confirmación de COD (no crear Order ni
  // programar correo1/correo2/SMS).
  if (isPrepaidOrder(payload.tags)) {
    return Response.json({ ok: true, skipped: "pago-anticipado" });
  }

  const order = await createOrderFromShopifyWebhook(payload);
  await sendEmail1IfNeeded(order); // "se manda de inmediato al crear el pedido"

  return Response.json({ ok: true, orderId: order.id, status: order.status });
}
