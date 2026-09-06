/**
 * Cliente genérico del bot de Telegram. El mismo bot se usa para dos cosas
 * distintas (secciones 7 y 8 del spec):
 * - Alertas administrativas al vendedor (sendTelegramAlert).
 * - Seguimiento post-confirmación con el cliente, opt-in (sendTelegramMessage
 *   con botones) — NO es el canal de confirmación de pedidos ni de la
 *   encuesta de entrega cuestionada, esos van por correo/SMS.
 */
export class TelegramError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TelegramError";
  }
}

export type InlineButton = { text: string; callback_data: string };

async function callTelegramApi(method: string, body: Record<string, unknown>): Promise<unknown> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new TelegramError("Falta TELEGRAM_BOT_TOKEN");
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const json = await response.json().catch(() => undefined);
  if (!response.ok) {
    throw new TelegramError(`Telegram (${method}) respondió ${response.status}: ${JSON.stringify(json)}`);
  }
  return json;
}

export async function sendTelegramAlert(text: string): Promise<void> {
  const chatId = process.env.ADMIN_TELEGRAM_CHAT_ID;
  if (!chatId) {
    throw new TelegramError("Falta ADMIN_TELEGRAM_CHAT_ID");
  }
  await callTelegramApi("sendMessage", { chat_id: chatId, text, parse_mode: "HTML" });
}

/**
 * Mensaje a un chat arbitrario (ej. el cliente que activó seguimiento),
 * opcionalmente con botones en fila (cada sub-arreglo es una fila).
 */
export async function sendTelegramMessage(
  chatId: string,
  text: string,
  buttonRows?: InlineButton[][],
): Promise<void> {
  await callTelegramApi("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    ...(buttonRows ? { reply_markup: { inline_keyboard: buttonRows } } : {}),
  });
}

export async function answerCallbackQuery(callbackQueryId: string, text?: string): Promise<void> {
  await callTelegramApi("answerCallbackQuery", { callback_query_id: callbackQueryId, text });
}
