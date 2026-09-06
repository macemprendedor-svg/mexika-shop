import { shopifyGraphql, ShopifyApiError } from "@/lib/shopify";

const ORDERS_QUERY = /* GraphQL */ `
  query RecentOrders($first: Int!) {
    orders(first: $first, sortKey: CREATED_AT, reverse: true) {
      nodes {
        id
        name
        createdAt
        displayFinancialStatus
        tags
        test
        totalPriceSet {
          shopMoney {
            amount
            currencyCode
          }
        }
        customer {
          displayName
          email
        }
        lineItems(first: 5) {
          nodes {
            title
            quantity
          }
        }
      }
    }
  }
`;

type OrdersResponse = {
  orders: {
    nodes: Array<{
      id: string;
      name: string;
      createdAt: string;
      displayFinancialStatus: string;
      tags: string[];
      test: boolean;
      totalPriceSet: { shopMoney: { amount: string; currencyCode: string } };
      customer: { displayName: string; email: string } | null;
      lineItems: { nodes: Array<{ title: string; quantity: number }> };
    }>;
  };
};

/**
 * Lista los pedidos más recientes de la tienda (solo lectura) para poder
 * identificar un pedido de prueba antes de correr mutaciones sobre él.
 * GET /api/shopify/orders?first=10
 */
export async function GET(request: Request) {
  const first = Number(new URL(request.url).searchParams.get("first") ?? "10");
  try {
    const data = await shopifyGraphql<OrdersResponse>(ORDERS_QUERY, { first });
    return Response.json({ ok: true, orders: data.orders.nodes });
  } catch (error) {
    if (error instanceof ShopifyApiError) {
      return Response.json(
        { ok: false, error: error.message, details: error.body },
        { status: error.status || 500 },
      );
    }
    const message = error instanceof Error ? error.message : "Error desconocido";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
