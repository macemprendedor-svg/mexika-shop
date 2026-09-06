import { prisma } from "@/lib/db";

/**
 * Historial de rechazados / "números quemados" (sección 4.2): contactos
 * con al menos un rechazo real de entrega, con el historial completo.
 * GET /api/numeros-quemados
 */
export async function GET() {
  const rejections = await prisma.deliveryIncident.findMany({
    where: { verdict: "REJECTED_BY_CUSTOMER" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      customerEmail: true,
      customerPhone: true,
      createdAt: true,
      order: { select: { shopifyOrderName: true } },
    },
  });

  const byContact = new Map<
    string,
    { email: string | null; phone: string | null; count: number; orders: string[] }
  >();

  for (const r of rejections) {
    const key = `${r.customerEmail ?? ""}|${r.customerPhone ?? ""}`;
    const entry = byContact.get(key) ?? {
      email: r.customerEmail,
      phone: r.customerPhone,
      count: 0,
      orders: [],
    };
    entry.count++;
    entry.orders.push(r.order.shopifyOrderName);
    byContact.set(key, entry);
  }

  return Response.json({ ok: true, contacts: Array.from(byContact.values()) });
}
