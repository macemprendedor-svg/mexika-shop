import { sendTelegramAlert, TelegramError } from "@/lib/telegram";

/**
 * SOLO DESARROLLO: manda un mensaje de prueba al bot de Telegram.
 * POST /api/dev/test-telegram
 */
export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return Response.json({ ok: false, error: "No disponible en producción" }, { status: 404 });
  }
  try {
    await sendTelegramAlert("✅ Prueba del sistema de alertas (Fase: detección de rechazos falsos).");
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof TelegramError) {
      return Response.json({ ok: false, error: error.message }, { status: 500 });
    }
    throw error;
  }
}
