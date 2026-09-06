import { shopifyGraphql, ShopifyApiError } from "@/lib/shopify";

const LIST_WEBHOOKS_QUERY = /* GraphQL */ `
  query ListWebhooks {
    webhookSubscriptions(first: 20) {
      nodes {
        id
        topic
        endpoint {
          __typename
          ... on WebhookHttpEndpoint {
            callbackUrl
          }
        }
      }
    }
  }
`;

/**
 * SOLO DESARROLLO: lista las suscripciones de webhook activas, para
 * verificar que apuntan a la URL pública correcta.
 * GET /api/dev/register-webhook
 */
export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return Response.json({ ok: false, error: "No disponible en producción" }, { status: 404 });
  }
  const data = await shopifyGraphql(LIST_WEBHOOKS_QUERY);
  return Response.json({ ok: true, data });
}

const CREATE_WEBHOOK_MUTATION = /* GraphQL */ `
  mutation CreateOrdersCreateWebhook($topic: WebhookSubscriptionTopic!, $webhookSubscription: WebhookSubscriptionInput!) {
    webhookSubscriptionCreate(topic: $topic, webhookSubscription: $webhookSubscription) {
      webhookSubscription {
        id
        topic
      }
      userErrors {
        field
        message
      }
    }
  }
`;

type CreateWebhookResponse = {
  webhookSubscriptionCreate: {
    webhookSubscription: {
      id: string;
      topic: string;
    } | null;
    userErrors: Array<{ field: string[] | null; message: string }>;
  };
};

/**
 * SOLO DESARROLLO: registra una suscripción de webhook en Shopify apuntando
 * a NEXT_PUBLIC_APP_URL (o a body.appUrl si se corre desde local). Se corre
 * una sola vez por topic (o cuando cambie el dominio público).
 * POST /api/dev/register-webhook
 * body: { topic: "ORDERS_CREATE" | "FULFILLMENT_EVENTS_CREATE", path: "/api/webhooks/...", appUrl?: string }
 */
export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return Response.json({ ok: false, error: "No disponible en producción" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const topic = (body?.topic as string | undefined) ?? "ORDERS_CREATE";
  const path = (body?.path as string | undefined) ?? "/api/webhooks/shopify/orders-create";
  // Permite apuntar al dominio público real aunque esta mutación se dispare
  // desde el servidor local (Shopify necesita una URL alcanzable, no localhost).
  const appUrl = (body?.appUrl as string | undefined) ?? process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) {
    return Response.json({ ok: false, error: "Falta NEXT_PUBLIC_APP_URL o body.appUrl" }, { status: 500 });
  }

  try {
    const data = await shopifyGraphql<CreateWebhookResponse>(CREATE_WEBHOOK_MUTATION, {
      topic,
      webhookSubscription: {
        uri: `${appUrl}${path}`,
        format: "JSON",
      },
    });

    const { userErrors, webhookSubscription } = data.webhookSubscriptionCreate;
    if (userErrors.length > 0) {
      return Response.json({ ok: false, error: userErrors }, { status: 400 });
    }

    return Response.json({ ok: true, webhookSubscription });
  } catch (error) {
    if (error instanceof ShopifyApiError) {
      return Response.json({ ok: false, error: error.message, details: error.body }, { status: 500 });
    }
    throw error;
  }
}
