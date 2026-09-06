"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, PhoneOff, UserX, History } from "lucide-react";
import { TopBar } from "../_components/topbar";
import { Card, KpiCard, Badge, PrimaryButton, SecondaryButton } from "../_components/ui";
import { formatAge, type ExceptionCategory } from "../_components/exception-meta";

type Exception = {
  orderId: string;
  orderName: string;
  category: ExceptionCategory;
  reason: string;
  ageMinutes: number;
};

type BurnedContact = { email: string | null; phone: string | null; count: number; orders: string[] };
type UnconfirmedOrder = {
  id: string;
  shopifyOrderName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  totalQuantity: number;
};
type BlockedZone = {
  id: string;
  postalCode: string | null;
  municipality: string | null;
  carrierName: string | null;
  reason: string;
};
type DecisionEntry = {
  id: string;
  previousStatus: string | null;
  newStatus: string;
  source: string;
  note: string | null;
  createdAt: string;
  order: { shopifyOrderName: string };
};

type RiskRow = {
  postalCode: string;
  municipality: string | null;
  carrierName: string | null;
  totalIncidents: number;
  falseRejections: number;
};

const TABS = ["Revisión actual", "Números quemados", "No confirmados", "Zonas bloqueadas", "Historial"] as const;

export default function RiesgoPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Revisión actual");
  const [reviewItems, setReviewItems] = useState<Exception[]>([]);
  const [burned, setBurned] = useState<BurnedContact[]>([]);
  const [unconfirmed, setUnconfirmed] = useState<UnconfirmedOrder[]>([]);
  const [zones, setZones] = useState<BlockedZone[]>([]);
  const [decisions, setDecisions] = useState<DecisionEntry[]>([]);
  const [ranking, setRanking] = useState<RiskRow[]>([]);
  const [busy, setBusy] = useState(false);

  function loadAll() {
    fetch("/api/excepciones")
      .then((r) => r.json())
      .then((j) =>
        setReviewItems((j.items ?? []).filter((i: Exception) => ["QUANTITY_REVIEW", "CUSTOMER_RISK_REVIEW"].includes(i.category))),
      );
    fetch("/api/numeros-quemados").then((r) => r.json()).then((j) => setBurned(j.contacts ?? []));
    fetch("/api/zonas-riesgo").then((r) => r.json()).then((j) => setRanking(j.ranking ?? []));
    fetch("/api/historial-no-confirmados").then((r) => r.json()).then((j) => setUnconfirmed(j.orders ?? []));
    fetch("/api/zonas-bloqueadas").then((r) => r.json()).then((j) => setZones(j.zones ?? []));
    fetch("/api/panel/historial-decisiones").then((r) => r.json()).then((j) => setDecisions(j.entries ?? []));
  }

  useEffect(loadAll, []);

  async function call(url: string, body: Record<string, unknown>) {
    setBusy(true);
    try {
      await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    } finally {
      setBusy(false);
      loadAll();
    }
  }

  return (
    <div>
      <TopBar title="Riesgo COD" subtitle="Revisa únicamente los pedidos que necesitan decisión humana." />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
        <KpiCard icon={AlertTriangle} label="En revisión" value={reviewItems.length} color="amber" />
        <KpiCard icon={PhoneOff} label="Números quemados" value={burned.length} color="red" />
        <KpiCard icon={UserX} label="No confirmados" value={unconfirmed.length} color="blue" />
        <KpiCard icon={History} label="Zonas bloqueadas" value={zones.length} color="violet" />
      </div>

      <div className="mb-4 flex gap-2">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
              tab === t ? "bg-blue-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <Card className="overflow-hidden">
        {tab === "Revisión actual" && (
          <Table
            head={["Pedido", "Motivo", "Antigüedad", ""]}
            rows={reviewItems.map((it) => [
              <span key="n" className="font-semibold text-slate-800">
                {it.orderName}
              </span>,
              it.reason,
              formatAge(it.ageMinutes),
              <div key="a" className="flex gap-2">
                <PrimaryButton
                  disabled={busy}
                  onClick={() =>
                    call(
                      `/api/pedidos/${it.orderId}/${it.category === "QUANTITY_REVIEW" ? "revision-cantidad" : "revision-riesgo-cliente"}`,
                      { decision: "APPROVED", decidedBy: "panel" },
                    )
                  }
                >
                  Aprobar
                </PrimaryButton>
                <SecondaryButton
                  disabled={busy}
                  onClick={() =>
                    call(
                      `/api/pedidos/${it.orderId}/${it.category === "QUANTITY_REVIEW" ? "revision-cantidad" : "revision-riesgo-cliente"}`,
                      { decision: "REJECTED", decidedBy: "panel" },
                    )
                  }
                >
                  Rechazar
                </SecondaryButton>
              </div>,
            ])}
            empty="Sin pedidos en revisión."
          />
        )}

        {tab === "Números quemados" && (
          <Table
            head={["Contacto", "Rechazos", "Pedidos"]}
            rows={burned.map((c) => [c.email ?? c.phone ?? "—", String(c.count), c.orders.join(", ")])}
            empty="Sin contactos con rechazos registrados."
          />
        )}

        {tab === "No confirmados" && (
          <Table
            head={["Pedido", "Contacto", "Cantidad", ""]}
            rows={unconfirmed.map((o) => [
              o.shopifyOrderName,
              o.customerEmail ?? o.customerPhone ?? "—",
              String(o.totalQuantity),
              <div key="a" className="flex gap-2">
                <PrimaryButton
                  disabled={busy}
                  onClick={() => call(`/api/historial-no-confirmados/${o.id}`, { action: "approve-inject", decidedBy: "panel" })}
                >
                  Aprobar e inyectar
                </PrimaryButton>
                <SecondaryButton
                  disabled={busy}
                  onClick={() => call(`/api/historial-no-confirmados/${o.id}`, { action: "delete", decidedBy: "panel" })}
                >
                  Eliminar
                </SecondaryButton>
              </div>,
            ])}
            empty="No hay pedidos sin confirmar."
          />
        )}

        {tab === "Zonas bloqueadas" && (
          <Table
            head={["CP", "Municipio", "Transportadora", "Motivo", ""]}
            rows={zones.map((z) => [
              z.postalCode ?? "Cualquiera",
              z.municipality ?? "—",
              z.carrierName ?? "Cualquiera",
              z.reason,
              <SecondaryButton
                key="a"
                disabled={busy}
                onClick={() => call(`/api/zonas-bloqueadas/${z.id}/desbloquear`, { reactivatedBy: "panel" })}
              >
                Desbloquear
              </SecondaryButton>,
            ])}
            empty="No hay bloqueos activos."
          />
        )}

        {tab === "Historial" && (
          <Table
            head={["Fecha", "Pedido", "Cambio", "Nota"]}
            rows={decisions.map((d) => [
              new Date(d.createdAt).toLocaleString("es-MX"),
              d.order.shopifyOrderName,
              <Badge key="b" color="slate">
                {d.newStatus}
              </Badge>,
              d.note ?? "—",
            ])}
            empty="Sin decisiones registradas todavía."
          />
        )}
      </Card>

      {tab === "Zonas bloqueadas" && (
        <Card className="mt-6 overflow-hidden">
          <div className="border-b border-slate-100 p-4">
            <h2 className="font-semibold text-slate-900">Ranking de zonas de riesgo</h2>
            <p className="text-xs text-slate-500">CP + transportadora con más rechazos falsos comprobados.</p>
          </div>
          <Table
            head={["CP", "Municipio", "Transportadora", "Rechazos falsos", "Total incidentes"]}
            rows={ranking.map((r) => [
              r.postalCode,
              r.municipality ?? "—",
              r.carrierName ?? "—",
              String(r.falseRejections),
              String(r.totalIncidents),
            ])}
            empty="Todavía no hay incidentes registrados."
          />
        </Card>
      )}
    </div>
  );
}

function Table({ head, rows, empty }: { head: string[]; rows: React.ReactNode[][]; empty: string }) {
  if (rows.length === 0) return <p className="p-6 text-sm text-slate-400">{empty}</p>;
  return (
    <table className="w-full text-sm">
      <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase text-slate-500">
        <tr>
          {head.map((h) => (
            <th key={h} className="px-4 py-2 text-left">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {rows.map((row, i) => (
          <tr key={i}>
            {row.map((cell, j) => (
              <td key={j} className="px-4 py-3 text-slate-700">
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
