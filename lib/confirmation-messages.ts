import type { Order } from "@prisma/client";

function buildConfirmationUrl(token: string, via: "email" | "sms"): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${base}/confirmar/${token}?via=${via}`;
}

export function buildEmail1(order: Order): { subject: string; html: string } {
  const confirmUrl = buildConfirmationUrl(order.confirmationToken, "email");
  return {
    subject: `Confirma tu pedido ${order.shopifyOrderName}`,
    html: `
      <p>¡Gracias por tu compra! Confirma tu pedido ${order.shopifyOrderName} para que salga a reparto.</p>
      <p>Ten disponible el importe exacto al momento de la entrega.</p>
      <p><a href="${confirmUrl}">Confirmar pedido</a></p>
    `,
  };
}

export function buildEmail2(order: Order): { subject: string; html: string } {
  const confirmUrl = buildConfirmationUrl(order.confirmationToken, "email");
  return {
    subject: `Sigue pendiente tu pedido ${order.shopifyOrderName}`,
    html: `
      <p>Todavía no hemos recibido tu confirmación para el pedido ${order.shopifyOrderName}.</p>
      <p>Si no confirmas pronto, el pedido se cancelará automáticamente.</p>
      <p><a href="${confirmUrl}">Confirmar pedido</a></p>
    `,
  };
}

export function buildSmsMessage(order: Order): string {
  const confirmUrl = buildConfirmationUrl(order.confirmationToken, "sms");
  return `Tu pedido ${order.shopifyOrderName} sigue pendiente de confirmar. Confírmalo aquí: ${confirmUrl}`;
}
