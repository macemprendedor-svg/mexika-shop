import { reconcileOrders } from "@/lib/reconciliation";

/**
 * Reconciliación periódica (sección 5): compara nuestra base contra el
 * estado real en Shopify. Protegido con CRON_SECRET.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (secret && authHeader !== `Bearer ${secret}`) {
    return Response.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }

  const drifts = await reconcileOrders();
  return Response.json({ ok: true, driftsFound: drifts.length, drifts });
}
