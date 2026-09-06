import { fetchShopifyOrderAsWebhookPayload } from "@/lib/shopify-orders";
import { createOrderFromShopifyWebhook } from "@/lib/orders";
import { sendEmail1IfNeeded } from "@/lib/confirmation-engine";

/**
 * SOLO DESARROLLO: importa un pedido real de Shopify por gid y lo mete al
 * pipeline como si hubiera llegado por el webhook orders/create. Sirve para
 * probar el flujo completo (incluyendo orderMarkAsPaid) antes de tener una
 * URL pública donde registrar el webhook de verdad.
 * POST /api/dev/import-order  { "shopifyOrderId": "gid://shopify/Order/..." }
 */
export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return Response.json({ ok: false, error: "No disponible en producción" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const shopifyOrderId = body?.shopifyOrderId as string | undefined;
  if (!shopifyOrderId) {
    return Response.json({ ok: false, error: "Falta shopifyOrderId" }, { status: 400 });
  }

  const payload = await fetchShopifyOrderAsWebhookPayload(shopifyOrderId);
  const order = await createOrderFromShopifyWebhook(payload);
  await sendEmail1IfNeeded(order);

  return Response.json({
    ok: true,
    orderId: order.id,
    status: order.status,
    confirmationToken: order.confirmationToken,
    confirmUrl: `${process.env.NEXT_PUBLIC_APP_URL}/confirmar/${order.confirmationToken}`,
  });
}
