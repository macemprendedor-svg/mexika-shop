import { prisma } from "@/lib/db";
import { computeAgeSemaphore } from "@/lib/age-semaphore";

/**
 * Vista Kanban de pedidos, agrupados por estatus, orden descendente por
 * fecha (sección 5). GET /api/pedidos?days=7
 */
export async function GET(request: Request) {
  const days = Number(new URL(request.url).searchParams.get("days") ?? "7");
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const orders = await prisma.order.findMany({
    where: { createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      shopifyOrderName: true,
      status: true,
      totalQuantity: true,
      totalPrice: true,
      currency: true,
      customerEmail: true,
      createdAt: true,
      updatedAt: true,
      telegramChatId: true,
      reminder1SentAt: true,
      reminder2SentAt: true,
      reminder3SentAt: true,
    },
  });

  const withSemaphore = orders.map((o) => ({
    ...o,
    semaphore: computeAgeSemaphore(o.updatedAt),
  }));

  const byStatus: Record<string, typeof withSemaphore> = {};
  for (const order of withSemaphore) {
    (byStatus[order.status] ??= []).push(order);
  }

  return Response.json({ ok: true, byStatus });
}
