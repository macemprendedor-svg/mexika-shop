import { getOrderByToken, confirmOrder, OrderServiceError } from "@/lib/orders";
import { prisma } from "@/lib/db";
import type { ConfirmationChannel } from "@prisma/client";

type RouteParams = { params: Promise<{ token: string }> };

/**
 * Acción de la página de confirmación del cliente (sección 10): confirmar o
 * cancelar el pedido. `via` viene del query param del link (email|sms) para
 * poder medir "% confirmado por correo vs SMS" (sección 5).
 */
export async function POST(request: Request, { params }: RouteParams) {
  const { token } = await params;
  const body = await request.json().catch(() => ({}));
  const action = body?.action as "confirm" | "cancel" | undefined;

  const order = await getOrderByToken(token);
  if (!order) {
    return Response.json({ ok: false, error: "Enlace inválido" }, { status: 404 });
  }
  if (order.confirmationTokenExpiresAt < new Date()) {
    return Response.json({ ok: false, error: "Este enlace ya venció" }, { status: 410 });
  }

  if (action === "cancel") {
    if (order.status !== "PENDING_CONFIRMATION") {
      return Response.json(
        { ok: false, error: `El pedido ya no está pendiente (estado: ${order.status})` },
        { status: 409 },
      );
    }
    const updated = await prisma.order.update({
      where: { id: order.id },
      data: {
        status: "CANCELLED_MANUAL",
        cancelledAt: new Date(),
        cancelReason: "Cancelado por el cliente en la página de confirmación",
      },
    });
    await prisma.orderStatusHistory.create({
      data: {
        orderId: order.id,
        previousStatus: order.status,
        newStatus: "CANCELLED_MANUAL",
        source: "customer",
      },
    });
    return Response.json({ ok: true, status: updated.status });
  }

  if (action === "confirm") {
    const via: ConfirmationChannel =
      new URL(request.url).searchParams.get("via") === "sms" ? "SMS" : "EMAIL";
    try {
      const updated = await confirmOrder(order.id, via, "customer");
      return Response.json({ ok: true, status: updated.status });
    } catch (error) {
      if (error instanceof OrderServiceError) {
        return Response.json({ ok: false, error: error.message }, { status: 409 });
      }
      throw error;
    }
  }

  return Response.json({ ok: false, error: "Acción inválida" }, { status: 400 });
}
