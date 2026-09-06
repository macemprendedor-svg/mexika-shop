import { prisma } from "@/lib/db";
import { sendReminder1, sendReminder2, sendReminder3 } from "@/lib/telegram-customer";
import { TelegramError } from "@/lib/telegram";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * Disparo MANUAL de los recordatorios de seguimiento (sección 8) — todavía
 * no hay detección automática de "salió a reparto" (depende de ver datos
 * reales de fulfillment events, sección 6 pendiente). Mientras tanto el
 * vendedor los dispara desde el panel.
 * POST /api/pedidos/[id]/recordatorio-telegram { stage: 1 | 2 | 3 }
 */
export async function POST(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const stage = body?.stage as 1 | 2 | 3 | undefined;

  const order = await prisma.order.findUniqueOrThrow({ where: { id } });
  if (!order.telegramChatId) {
    return Response.json(
      { ok: false, error: "El cliente no activó seguimiento por Telegram para este pedido" },
      { status: 409 },
    );
  }

  try {
    if (stage === 1) await sendReminder1(order);
    else if (stage === 2) await sendReminder2(order);
    else if (stage === 3) await sendReminder3(order);
    else return Response.json({ ok: false, error: "stage debe ser 1, 2 o 3" }, { status: 400 });

    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof TelegramError) {
      return Response.json({ ok: false, error: error.message }, { status: 500 });
    }
    throw error;
  }
}
