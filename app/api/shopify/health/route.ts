import { shopifyGraphql, getAccessTokenDiagnostics, ShopifyApiError } from "@/lib/shopify";

const SHOP_QUERY = /* GraphQL */ `
  query ShopHealth {
    shop {
      name
      myshopifyDomain
      email
    }
  }
`;

type ShopHealthResponse = {
  shop: {
    name: string;
    myshopifyDomain: string;
    email: string;
  };
};

/**
 * Verifica que las credenciales de Shopify funcionan: hace el client
 * credentials grant (client_id + client_secret -> access_token) y luego
 * consulta la tienda con ese token.
 * GET /api/shopify/health
 */
export async function GET() {
  try {
    const data = await shopifyGraphql<ShopHealthResponse>(SHOP_QUERY);
    const token = await getAccessTokenDiagnostics();
    return Response.json({ ok: true, shop: data.shop, token });
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
