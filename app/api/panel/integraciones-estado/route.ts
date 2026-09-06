import { shopifyGraphql } from "@/lib/shopify";

type IntegrationStatus = { name: string; connected: boolean; detail?: string };

async function checkShopify(): Promise<IntegrationStatus> {
  try {
    await shopifyGraphql("query { shop { name } }");
    return { name: "Shopify", connected: true };
  } catch (error) {
    return { name: "Shopify", connected: false, detail: error instanceof Error ? error.message : undefined };
  }
}

async function checkResend(): Promise<IntegrationStatus> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { name: "Correo", connected: false, detail: "Sin API key" };
  try {
    const res = await fetch("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${key}` },
    });
    return { name: "Correo", connected: res.ok };
  } catch {
    return { name: "Correo", connected: false };
  }
}

async function checkSms(): Promise<IntegrationStatus> {
  // No hay un endpoint de salud confirmado en la doc de smsmasivos.com.mx
  // (el que se probó devolvió 404) — reportamos "configurado" en vez de
  // adivinar un endpoint y arriesgar un falso "desconectado".
  const key = process.env.SMSMASIVOS_API_KEY;
  return key
    ? { name: "SMS", connected: true, detail: "API key configurada (sin chequeo en vivo)" }
    : { name: "SMS", connected: false, detail: "Sin API key" };
}

async function checkTelegram(): Promise<IntegrationStatus> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { name: "Telegram", connected: false, detail: "Sin token" };
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const json = await res.json();
    return { name: "Telegram", connected: !!json.ok };
  } catch {
    return { name: "Telegram", connected: false };
  }
}

/**
 * Estado real de las integraciones que sí monitoreamos vía API. Dropi y
 * Releasit no aparecen: no tenemos ninguna llamada directa a ellos desde
 * este sistema (Dropi no expone API REST; Releasit vive en el checkout de
 * Shopify, no lo llamamos nosotros).
 * GET /api/panel/integraciones-estado
 */
export async function GET() {
  const [shopify, resend, sms, telegram] = await Promise.all([
    checkShopify(),
    checkResend(),
    checkSms(),
    checkTelegram(),
  ]);
  return Response.json({ ok: true, integrations: [shopify, resend, sms, telegram] });
}
