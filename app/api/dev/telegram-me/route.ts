/**
 * SOLO DESARROLLO: consulta getMe para obtener el username del bot (útil
 * para armar el deep link t.me/<username>?start=...).
 * GET /api/dev/telegram-me
 */
export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return Response.json({ ok: false, error: "No disponible en producción" }, { status: 404 });
  }
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return Response.json({ ok: false, error: "Falta TELEGRAM_BOT_TOKEN" }, { status: 500 });
  }
  const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
  return Response.json(await res.json());
}
