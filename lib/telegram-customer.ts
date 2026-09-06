import { prisma } from "@/lib/db";
import { sendTelegramMessage, sendTelegramAlert, TelegramError } from "@/lib/telegram";
import { createIncidentFromCustomerReport } from "@/lib/incidents";
import type { Order } from "@prisma/client";

/**
 * Seguimiento por Telegram post-confirmación (sección 8). Opt-in del
 * cliente vía deep link desde la página de confirmación — el token
 * reutiliza confirmationToken, ya generado para ese pedido.
 */
export async function linkTelegramChat(confirmationToken: string, chatId: string): Promise<Order | null> {
  const order = await prisma.order.findUnique({ where: { confirmationToken } });
  if (!order) return null;

  return prisma.order.update({
    where: { id: order.id },
    data: { telegramChatId: chatId, telegramLinkedAt: new Date() },
  });
}

function trackingUrl(confirmationToken: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${base}/seguimiento/${confirmationToken}`;
}

/** 1. Inicio del reparto: "Tu pedido sale hoy a entrega". */
export async function sendReminder1(order: Order): Promise<void> {
  if (!order.telegramChatId) return;
  await sendTelegramMessage(
    order.telegramChatId,
    `📦 ¡Tu pedido ${order.shopifyOrderName} sale hoy a entrega!`,
  );
  await prisma.order.update({ where: { id: order.id }, data: { reminder1SentAt: new Date() } });
}

/** 2. Seguimiento intermedio con botones. */
export async function sendReminder2(order: Order): Promise<void> {
  if (!order.telegramChatId) return;
  await sendTelegramMessage(
    order.telegramChatId,
    `🚚 Tu pedido ${order.shopifyOrderName} sigue en camino. ¿Cómo va todo?`,
    [
      [
        { text: "Sigo esperando", callback_data: `sigo_esperando:${order.id}` },
        { text: "Ya llegó", callback_data: `ya_llego:${order.id}` },
      ],
      [{ text: "Necesito ayuda", callback_data: `necesito_ayuda:${order.id}` }],
    ],
  );
  await prisma.order.update({ where: { id: order.id }, data: { reminder2SentAt: new Date() } });
}

/** 3. Último aviso: contacto del vendedor + botón de reporte. */
export async function sendReminder3(order: Order): Promise<void> {
  if (!order.telegramChatId) return;
  await sendTelegramMessage(
    order.telegramChatId,
    `⏰ Último aviso de tu pedido ${order.shopifyOrderName}. Si tienes dudas, contáctanos.\n\nSeguimiento: ${trackingUrl(order.confirmationToken)}`,
    [[{ text: "Reportar que no visitaron mi domicilio", callback_data: `reportar_no_visitaron:${order.id}` }]],
  );
  await prisma.order.update({ where: { id: order.id }, data: { reminder3SentAt: new Date() } });
}

async function notifyAdminSafely(text: string): Promise<void> {
  try {
    await sendTelegramAlert(text);
  } catch (error) {
    if (!(error instanceof TelegramError)) throw error;
  }
}

/**
 * Maneja los callback_data de los botones de seguimiento del cliente.
 * Devuelve el texto de confirmación a mostrarle (answerCallbackQuery).
 */
export async function handleCustomerCallback(action: string, orderId: string): Promise<string> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return "Pedido no encontrado.";

  switch (action) {
    case "sigo_esperando":
      return "Gracias, seguimos pendientes de tu entrega.";
    case "ya_llego":
      await notifyAdminSafely(`✅ ${order.shopifyOrderName}: el cliente confirmó que ya le llegó.`);
      return "¡Qué bueno! Gracias por avisarnos.";
    case "necesito_ayuda":
      await notifyAdminSafely(`🆘 ${order.shopifyOrderName}: el cliente pidió ayuda por Telegram.`);
      return "Le avisamos al vendedor, te contactará pronto.";
    case "reportar_no_visitaron":
      await createIncidentFromCustomerReport(order.id);
      await notifyAdminSafely(
        `🚨 ${order.shopifyOrderName}: el cliente reportó que NO visitaron su domicilio (vía Telegram).`,
      );
      return "Recibido — vamos a revisar qué pasó con la transportadora.";
    default:
      return "Acción no reconocida.";
  }
}
