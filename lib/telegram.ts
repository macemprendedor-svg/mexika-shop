/**
 * Alertas al bot personal de Telegram del vendedor (sección 7 del spec).
 * Por ahora solo se usa para avisos administrativos (ej. zona/transportadora
 * bloqueada) — NO es el canal de confirmación de pedidos ni de la encuesta
 * al cliente, esos van por correo/SMS.
 */
export class TelegramError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TelegramError";
  }
}

export async function sendTelegramAlert(text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.ADMIN_TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    throw new TelegramError("Falta TELEGRAM_BOT_TOKEN y/o ADMIN_TELEGRAM_CHAT_ID");
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => undefined);
    throw new TelegramError(`Telegram respondió ${response.status}: ${JSON.stringify(body)}`);
  }
}
