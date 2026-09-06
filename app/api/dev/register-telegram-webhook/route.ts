/**
 * SOLO DESARROLLO: registra el webhook del bot de Telegram apuntando a la
 * URL pública real (Telegram no puede llegar a localhost).
 * POST /api/dev/register-telegram-webhook { "appUrl": "https://..." }
 */
export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return Response.json({ ok: false, error: "No disponible en producción" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const appUrl = (body?.appUrl as string | undefined) ?? process.env.NEXT_PUBLIC_APP_URL;
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;

  if (!token) {
    return Response.json({ ok: false, error: "Falta TELEGRAM_BOT_TOKEN" }, { status: 500 });
  }
  if (!appUrl) {
    return Response.json({ ok: false, error: "Falta NEXT_PUBLIC_APP_URL o body.appUrl" }, { status: 500 });
  }

  const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: `${appUrl}/api/telegram/webhook`,
      secret_token: secret,
    }),
  });

  return Response.json(await res.json());
}
