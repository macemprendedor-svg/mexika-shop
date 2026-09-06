import { getOrderByToken } from "@/lib/orders";
import { ConfirmActions } from "./confirm-actions";

type PageProps = { params: Promise<{ token: string }> };

type LineItem = { title: string; quantity: number; price: string };
type ShippingAddress = {
  address1?: string;
  address2?: string;
  city?: string;
  province?: string;
  zip?: string;
};

export default async function ConfirmationPage({ params }: PageProps) {
  const { token } = await params;
  const order = await getOrderByToken(token);

  if (!order) {
    return <StatusMessage title="Enlace inválido" message="Este enlace de confirmación no existe." />;
  }

  if (order.confirmationTokenExpiresAt < new Date()) {
    return <StatusMessage title="Enlace vencido" message="Este enlace de confirmación ya venció." />;
  }

  if (order.status !== "PENDING_CONFIRMATION") {
    return (
      <StatusMessage
        title={`Pedido ${order.shopifyOrderName}`}
        message={`Este pedido ya no está pendiente de confirmación (estado: ${order.status}).`}
      />
    );
  }

  const lineItems: LineItem[] = JSON.parse(order.lineItemsJson);
  const address: ShippingAddress | null = order.shippingAddressJson
    ? JSON.parse(order.shippingAddressJson)
    : null;

  return (
    <main style={{ maxWidth: 480, margin: "40px auto", padding: 16, fontFamily: "system-ui" }}>
      <h1>Confirma tu pedido {order.shopifyOrderName}</h1>

      <section style={{ margin: "24px 0" }}>
        <h2 style={{ fontSize: 16 }}>Productos</h2>
        <ul>
          {lineItems.map((item, i) => (
            <li key={i}>
              {item.quantity} × {item.title}
            </li>
          ))}
        </ul>
      </section>

      <p>
        <strong>Total a pagar: </strong>
        {order.totalPrice} {order.currency}
      </p>

      {address && (
        <section style={{ margin: "24px 0" }}>
          <h2 style={{ fontSize: 16 }}>Dirección de entrega</h2>
          <p>
            {address.address1} {address.address2}
            <br />
            {address.city}, {address.province} {address.zip}
          </p>
        </section>
      )}

      <p style={{ fontWeight: "bold" }}>Ten disponible el importe exacto.</p>

      <ConfirmActions token={token} />
    </main>
  );
}

function StatusMessage({ title, message }: { title: string; message: string }) {
  return (
    <main style={{ maxWidth: 480, margin: "40px auto", padding: 16, fontFamily: "system-ui" }}>
      <h1>{title}</h1>
      <p>{message}</p>
    </main>
  );
}
