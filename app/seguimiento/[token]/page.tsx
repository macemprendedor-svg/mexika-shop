import { getOrderByToken } from "@/lib/orders";
import { ReportActions } from "./report-actions";

type PageProps = { params: Promise<{ token: string }> };

const STATUS_LABELS: Record<string, string> = {
  PENDING_CONFIRMATION: "Esperando tu confirmación",
  CONFIRMED: "Confirmado, preparando el envío",
  QUANTITY_REVIEW: "En revisión",
  BLOCKED_QUANTITY: "Bloqueado",
  SENT_TO_DROPI: "En camino",
  PAUSED_ZONE_BLOCKED: "En revisión por tu zona de entrega",
  CANCELLED_NOT_CONFIRMED: "Cancelado (no se confirmó a tiempo)",
  CANCELLED_MANUAL: "Cancelado",
  CANCELLED_DELIVERY_INCIDENT: "Cancelado por incidencia de entrega",
};

export default async function TrackingPage({ params }: PageProps) {
  const { token } = await params;
  const order = await getOrderByToken(token);

  if (!order) {
    return (
      <main style={{ maxWidth: 480, margin: "40px auto", padding: 16, fontFamily: "system-ui" }}>
        <h1>Enlace inválido</h1>
      </main>
    );
  }

  const canReport = order.status === "SENT_TO_DROPI";

  return (
    <main style={{ maxWidth: 480, margin: "40px auto", padding: 16, fontFamily: "system-ui" }}>
      <h1>Pedido {order.shopifyOrderName}</h1>
      <p>
        Estatus: <strong>{STATUS_LABELS[order.status] ?? order.status}</strong>
      </p>
      {canReport && <ReportActions token={token} />}
    </main>
  );
}
