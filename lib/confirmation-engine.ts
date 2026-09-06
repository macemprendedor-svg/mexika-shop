import { prisma } from "@/lib/db";
import { sendEmail, MailerError } from "@/lib/mailer";
import { sendSms, SmsError } from "@/lib/sms";
import { buildEmail1, buildEmail2, buildSmsMessage } from "@/lib/confirmation-messages";
import { cancelExpiredUnconfirmedOrders } from "@/lib/orders";
import type { Order } from "@prisma/client";

async function recordHistory(orderId: string, status: string, source: string, note: string) {
  await prisma.orderStatusHistory.create({
    data: { orderId, previousStatus: status, newStatus: status, source, note },
  });
}

/**
 * Correo 1: se manda de inmediato al crear el pedido (sección 2, paso 1).
 * Se llama justo después de capturar el webhook orders/create. Un fallo acá
 * no debe tumbar la respuesta del webhook — se registra y ya.
 */
export async function sendEmail1IfNeeded(order: Order): Promise<void> {
  if (order.email1SentAt || !order.customerEmail) return;

  try {
    const { subject, html } = buildEmail1(order);
    await sendEmail({ to: order.customerEmail, subject, html });
    await prisma.order.update({ where: { id: order.id }, data: { email1SentAt: new Date() } });
  } catch (error) {
    const message = error instanceof MailerError ? error.message : String(error);
    await recordHistory(order.id, order.status, "confirmation-engine", `Falló correo 1: ${message}`);
  }
}

async function sendEmail2IfDue(order: Order, now: Date): Promise<void> {
  if (order.email2SentAt || !order.customerEmail) return;
  if (now < order.scheduledEmail2At) return;

  try {
    const { subject, html } = buildEmail2(order);
    await sendEmail({ to: order.customerEmail, subject, html });
    await prisma.order.update({ where: { id: order.id }, data: { email2SentAt: now } });
  } catch (error) {
    const message = error instanceof MailerError ? error.message : String(error);
    await recordHistory(order.id, order.status, "confirmation-engine", `Falló correo 2: ${message}`);
  }
}

async function sendSmsIfDue(order: Order, now: Date): Promise<void> {
  if (order.smsSentAt || !order.customerPhone) return;
  if (now < order.scheduledSmsAt) return;

  try {
    await sendSms({ to: order.customerPhone, body: buildSmsMessage(order) });
    await prisma.order.update({ where: { id: order.id }, data: { smsSentAt: now } });
  } catch (error) {
    const message = error instanceof SmsError ? error.message : String(error);
    await recordHistory(order.id, order.status, "confirmation-engine", `Falló SMS: ${message}`);
  }
}

export type ProcessConfirmationsResult = {
  email2Checked: number;
  smsChecked: number;
  cancelledUnconfirmed: number;
};

/**
 * Pasada del cron: manda correo2/SMS a los pedidos que ya cumplieron su
 * ventana y siguen sin confirmar, y cancela los que nunca confirmaron tras
 * el SMS. Pensado para invocarse periódicamente (ver /api/cron/process-confirmations).
 */
export async function processPendingConfirmations(): Promise<ProcessConfirmationsResult> {
  const now = new Date();

  const pending = await prisma.order.findMany({ where: { status: "PENDING_CONFIRMATION" } });

  let email2Checked = 0;
  let smsChecked = 0;

  for (const order of pending) {
    if (!order.email2SentAt && now >= order.scheduledEmail2At) {
      await sendEmail2IfDue(order, now);
      email2Checked++;
    }
    if (!order.smsSentAt && now >= order.scheduledSmsAt) {
      await sendSmsIfDue(order, now);
      smsChecked++;
    }
  }

  const cancelledUnconfirmed = await cancelExpiredUnconfirmedOrders();

  return { email2Checked, smsChecked, cancelledUnconfirmed };
}
