import { linkTelegramChat, handleCustomerCallback } from "@/lib/telegram-customer";
import { sendTelegramMessage, answerCallbackQuery, TelegramError } from "@/lib/telegram";

type TelegramUpdate = {
  message?: {
    chat: { id: number };
    text?: string;
  };
  callback_query?: {
    id: string;
    data?: string;
    message?: { chat: { id: number } };
  };
};

/**
 * Webhook del bot de Telegram (seguimiento del cliente, sección 8).
 * Verificado con el secret_token que Telegram devuelve en el header
 * X-Telegram-Bot-Api-Secret-Token (configurado al registrar el webhook).
 */
export async function POST(request: Request) {
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const receivedSecret = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
  if (expectedSecret && receivedSecret !== expectedSecret) {
    return Response.json({ ok: false, error: "Firma inválida" }, { status: 401 });
  }

  const update: TelegramUpdate = await request.json();

  if (update.message?.text?.startsWith("/start")) {
    const chatId = String(update.message.chat.id);
    const parts = update.message.text.split(" ");
    const token = parts[1];

    if (token) {
      const order = await linkTelegramChat(token, chatId);
      if (order) {
        await sendTelegramMessage(
          chatId,
          `✅ Listo, te avisaremos por aquí sobre tu pedido ${order.shopifyOrderName} cuando esté en camino.`,
        );
      } else {
        await sendTelegramMessage(chatId, "No encontramos ese pedido. Verifica el enlace.");
      }
    } else {
      await sendTelegramMessage(chatId, "Hola 👋. Activa el seguimiento desde el enlace de confirmación de tu pedido.");
    }
    return Response.json({ ok: true });
  }

  if (update.callback_query) {
    const [action, orderId] = (update.callback_query.data ?? "").split(":");
    // Los efectos (crear incidente, avisar al admin, etc) ya corrieron aquí
    // dentro; si el "answer" cosmético de Telegram falla después, NO debe
    // devolver error — eso haría que Telegram reintregue el update entero y
    // duplique esos efectos.
    const replyText = orderId ? await handleCustomerCallback(action, orderId) : "Solicitud inválida.";
    try {
      await answerCallbackQuery(update.callback_query.id, replyText);
    } catch (error) {
      if (!(error instanceof TelegramError)) throw error;
    }
    return Response.json({ ok: true });
  }

  return Response.json({ ok: true });
}
