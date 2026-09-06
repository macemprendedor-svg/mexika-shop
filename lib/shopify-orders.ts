import { shopifyGraphql } from "@/lib/shopify";
import type { ShopifyOrderWebhookPayload } from "@/lib/orders";

const ORDER_BY_ID_QUERY = /* GraphQL */ `
  query OrderById($id: ID!) {
    order(id: $id) {
      id
      name
      createdAt
      email
      phone
      totalPriceSet {
        shopMoney {
          amount
          currencyCode
        }
      }
      shippingAddress {
        address1
        address2
        city
        provinceCode
        zip
      }
      lineItems(first: 50) {
        nodes {
          title
          quantity
          originalUnitPriceSet {
            shopMoney {
              amount
            }
          }
        }
      }
    }
  }
`;

type OrderByIdResponse = {
  order: {
    id: string;
    name: string;
    createdAt: string;
    email: string | null;
    phone: string | null;
    totalPriceSet: { shopMoney: { amount: string; currencyCode: string } };
    shippingAddress: {
      address1: string | null;
      address2: string | null;
      city: string | null;
      provinceCode: string | null;
      zip: string | null;
    } | null;
    lineItems: {
      nodes: Array<{
        title: string;
        quantity: number;
        originalUnitPriceSet: { shopMoney: { amount: string } };
      }>;
    };
  } | null;
};

/**
 * Trae un pedido real de Shopify por gid y lo mapea al mismo shape que usa
 * el webhook orders/create, para poder probar el pipeline completo (Fase 1)
 * sin necesitar todavía una URL pública donde Shopify entregue el webhook.
 */
export async function fetchShopifyOrderAsWebhookPayload(
  gid: string,
): Promise<ShopifyOrderWebhookPayload> {
  const data = await shopifyGraphql<OrderByIdResponse>(ORDER_BY_ID_QUERY, { id: gid });
  if (!data.order) {
    throw new Error(`No se encontró el pedido ${gid} en Shopify`);
  }
  const o = data.order;
  const numericId = o.id.split("/").pop()!;

  return {
    id: numericId,
    name: o.name,
    created_at: o.createdAt,
    email: o.email,
    phone: o.phone,
    total_price: o.totalPriceSet.shopMoney.amount,
    currency: o.totalPriceSet.shopMoney.currencyCode,
    shipping_address: o.shippingAddress
      ? {
          address1: o.shippingAddress.address1,
          address2: o.shippingAddress.address2,
          city: o.shippingAddress.city,
          province: o.shippingAddress.provinceCode,
          zip: o.shippingAddress.zip,
        }
      : null,
    line_items: o.lineItems.nodes.map((li) => ({
      title: li.title,
      quantity: li.quantity,
      price: li.originalUnitPriceSet.shopMoney.amount,
    })),
  };
}
