import { shopifyGraphql, ShopifyApiError } from "@/lib/shopify";

/**
 * "Envío controlado a Dropi" (sección 1 y 11 del spec): Dropify está
 * configurado para sincronizar solo órdenes con financial_status PAID
 * ("Sincronizar órdenes pagadas automáticamente"), no todas. Como los
 * pedidos COD nacen con pago pendiente, marcar la orden como pagada en
 * Shopify vía orderMarkAsPaid es la señal que hace que Dropify la recoja
 * en su siguiente ciclo (5-10 min) y la mande a Dropi.
 *
 * Requiere el scope write_orders + el permiso "mark_orders_as_paid" del
 * lado de la tienda (Shopify). Si la tienda no tiene ese permiso habilitado,
 * la mutación devuelve un userError explícito, no un fallo silencioso.
 */

const MARK_AS_PAID_MUTATION = /* GraphQL */ `
  mutation MarkOrderAsPaid($input: OrderMarkAsPaidInput!) {
    orderMarkAsPaid(input: $input) {
      userErrors {
        field
        message
      }
      order {
        id
        name
        canMarkAsPaid
        displayFinancialStatus
      }
    }
  }
`;

type MarkAsPaidResponse = {
  orderMarkAsPaid: {
    userErrors: Array<{ field: string[] | null; message: string }>;
    order: {
      id: string;
      name: string;
      canMarkAsPaid: boolean;
      displayFinancialStatus: string;
    } | null;
  };
};

export class DropiHandoffError extends Error {
  constructor(
    message: string,
    public readonly userErrors?: Array<{ field: string[] | null; message: string }>,
  ) {
    super(message);
    this.name = "DropiHandoffError";
  }
}

/**
 * Marca la orden como pagada en Shopify para que Dropify la sincronice a
 * Dropi. `shopifyOrderId` debe ser el gid completo (gid://shopify/Order/...).
 */
export async function markOrderAsPaidForDropi(shopifyOrderId: string): Promise<{
  name: string;
  displayFinancialStatus: string;
}> {
  let data: MarkAsPaidResponse;
  try {
    data = await shopifyGraphql<MarkAsPaidResponse>(MARK_AS_PAID_MUTATION, {
      input: { id: shopifyOrderId },
    });
  } catch (error) {
    if (error instanceof ShopifyApiError) {
      throw new DropiHandoffError(`Error de Shopify al marcar como pagada: ${error.message}`);
    }
    throw error;
  }

  const { userErrors, order } = data.orderMarkAsPaid;

  if (userErrors.length > 0) {
    throw new DropiHandoffError(
      `Shopify rechazó orderMarkAsPaid: ${userErrors.map((e) => e.message).join("; ")}`,
      userErrors,
    );
  }

  if (!order) {
    throw new DropiHandoffError("orderMarkAsPaid no devolvió la orden");
  }

  return { name: order.name, displayFinancialStatus: order.displayFinancialStatus };
}
