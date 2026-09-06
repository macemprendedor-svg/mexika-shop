import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verifica la firma HMAC-SHA256 (header X-Shopify-Hmac-Sha256) que Shopify
 * manda en cada webhook, usando el client_secret de la app como clave sobre
 * el cuerpo crudo (sin parsear) de la petición.
 */
export function verifyShopifyWebhookHmac(rawBody: string, hmacHeader: string | null): boolean {
  if (!hmacHeader) return false;

  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;
  if (!clientSecret) {
    throw new Error("Falta SHOPIFY_CLIENT_SECRET en las variables de entorno");
  }

  const computed = createHmac("sha256", clientSecret).update(rawBody, "utf8").digest("base64");

  const computedBuffer = Buffer.from(computed, "utf8");
  const headerBuffer = Buffer.from(hmacHeader, "utf8");

  if (computedBuffer.length !== headerBuffer.length) return false;
  return timingSafeEqual(computedBuffer, headerBuffer);
}
