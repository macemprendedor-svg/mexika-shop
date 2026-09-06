/**
 * SOLO DESARROLLO: lee los updates recientes del bot de Telegram para
 * identificar el chat_id del admin (útil una sola vez, al configurar).
 * GET /api/dev/telegram-updates
 */
export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return Response.json({ ok: false, error: "No disponible en producción" }, { status: 404 });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return Response.json({ ok: false, error: "Falta TELEGRAM_BOT_TOKEN" }, { status: 500 });
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/getUpdates`);
  const json = await response.json();
  return Response.json(json);
}
