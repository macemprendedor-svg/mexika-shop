"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Clock, UserX, CheckCircle2, X } from "lucide-react";
import { TopBar } from "../_components/topbar";
import { Card, KpiCard, Badge, PrimaryButton, SecondaryButton } from "../_components/ui";
import { EXCEPTION_META, formatAge, type ExceptionCategory } from "../_components/exception-meta";

type Exception = {
  orderId: string;
  orderName: string;
  category: ExceptionCategory;
  reason: string;
  recommendedAction: string;
  ageMinutes: number;
};

type HistoryEntry = {
  id: string;
  previousStatus: string | null;
  newStatus: string;
  source: string;
  note: string | null;
  createdAt: string;
};

type OrderDetail = {
  id: string;
  shopifyOrderName: string;
  status: string;
  totalQuantity: number;
  totalPrice: string;
  currency: string;
  customerEmail: string | null;
  customerPhone: string | null;
  statusHistory: HistoryEntry[];
};

export default function AccionesPage() {
  const [items, setItems] = useState<Exception[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Exception | null>(null);
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<ExceptionCategory | "TODAS">("TODAS");

  function load() {
    fetch("/api/excepciones")
      .then((r) => r.json())
      .then((json) => setItems(json.items ?? []))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  function selectRow(it: Exception | null) {
    setSelected(it);
    setDetail(null);
  }

  useEffect(() => {
    if (!selected) return;
    fetch(`/api/pedidos/${selected.orderId}`)
      .then((r) => r.json())
      .then((json) => setDetail(json.order ?? null));
  }, [selected]);

  const counts = {
    red: items.filter((i) => EXCEPTION_META[i.category].badgeColor === "red").length,
    orange: items.filter((i) => EXCEPTION_META[i.category].badgeColor === "orange" || EXCEPTION_META[i.category].badgeColor === "violet").length,
    amber: items.filter((i) => EXCEPTION_META[i.category].badgeColor === "amber" || EXCEPTION_META[i.category].badgeColor === "blue").length,
  };

  const filtered = filter === "TODAS" ? items : items.filter((i) => i.category === filter);

  async function callEndpoint(url: string, body: Record<string, unknown>) {
    setBusy(true);
    try {
      await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } finally {
      setBusy(false);
      setSelected(null);
      load();
    }
  }

  return (
    <div>
      <TopBar title="Bandeja de acciones pendientes" subtitle="Pedidos ordenados por urgencia." />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard icon={AlertTriangle} label="Críticas" value={counts.red} color="red" />
        <KpiCard icon={Clock} label="Altas" value={counts.orange} color="orange" hint="zona bloqueada / riesgo cliente" />
        <KpiCard icon={UserX} label="Media" value={counts.amber} color="amber" hint="cantidad / no confirmados" />
      </div>

      <div className="mb-4 flex gap-2">
        {(["TODAS", "STUCK_BEFORE_DROPI", "ZONE_BLOCKED", "CUSTOMER_RISK_REVIEW", "QUANTITY_REVIEW", "UNCONFIRMED_HISTORY"] as const).map(
          (f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                filter === f ? "bg-blue-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"
              }`}
            >
              {f === "TODAS" ? `Todas (${items.length})` : EXCEPTION_META[f].actionLabel}
            </button>
          ),
        )}
      </div>

      <div className="flex gap-6">
        <Card className="flex-1 overflow-hidden">
          {loading ? (
            <p className="p-6 text-sm text-slate-400">Cargando…</p>
          ) : filtered.length === 0 ? (
            <p className="p-6 text-sm text-slate-400">Sin excepciones en esta vista.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2 text-left">Prioridad</th>
                  <th className="px-4 py-2 text-left">Pedido</th>
                  <th className="px-4 py-2 text-left">Motivo</th>
                  <th className="px-4 py-2 text-left">Antigüedad</th>
                  <th className="px-4 py-2 text-left">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((it) => {
                  const meta = EXCEPTION_META[it.category];
                  return (
                    <tr
                      key={it.orderId + it.category}
                      onClick={() => selectRow(it)}
                      className={`cursor-pointer hover:bg-slate-50 ${selected?.orderId === it.orderId ? "bg-blue-50/50" : ""}`}
                    >
                      <td className="px-4 py-3">
                        <Badge color={meta.badgeColor}>{meta.label}</Badge>
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-800">{it.orderName}</td>
                      <td className="px-4 py-3 text-slate-600">{it.reason}</td>
                      <td className="px-4 py-3 text-slate-500">{formatAge(it.ageMinutes)}</td>
                      <td className="px-4 py-3 text-blue-600">{meta.actionLabel}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>

        {selected && (
          <Card className="w-96 flex-shrink-0 p-5">
            <div className="mb-3 flex items-start justify-between">
              <div>
                <Badge color={EXCEPTION_META[selected.category].badgeColor}>
                  {EXCEPTION_META[selected.category].label}
                </Badge>
                <h3 className="mt-2 font-semibold text-slate-900">{selected.orderName}</h3>
                <p className="text-sm text-slate-500">{selected.reason}</p>
              </div>
              <button onClick={() => selectRow(null)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            {detail && (
              <>
                <div className="mb-4 rounded-lg bg-slate-50 p-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Total</span>
                    <span className="font-semibold">
                      {detail.totalPrice} {detail.currency}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Cantidad</span>
                    <span className="font-semibold">{detail.totalQuantity}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Contacto</span>
                    <span className="font-semibold">{detail.customerEmail ?? detail.customerPhone ?? "—"}</span>
                  </div>
                </div>

                <div className="mb-4">
                  <h4 className="mb-2 text-xs font-semibold uppercase text-slate-400">Historial</h4>
                  <div className="space-y-2">
                    {detail.statusHistory.slice(-5).map((h) => (
                      <div key={h.id} className="flex items-start gap-2 text-xs">
                        <CheckCircle2 size={14} className="mt-0.5 flex-shrink-0 text-green-500" />
                        <div>
                          <div className="font-medium text-slate-700">{h.newStatus}</div>
                          {h.note && <div className="text-slate-500">{h.note}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            <div className="space-y-2">
              {selected.category === "STUCK_BEFORE_DROPI" && (
                <PrimaryButton
                  color="red"
                  disabled={busy}
                  onClick={() => callEndpoint(`/api/pedidos/${selected.orderId}/reintentar-dropi`, { decidedBy: "panel" })}
                >
                  Reintentar envío a Dropi
                </PrimaryButton>
              )}
              {selected.category === "ZONE_BLOCKED" && (
                <PrimaryButton
                  disabled={busy}
                  onClick={() => callEndpoint(`/api/pedidos/${selected.orderId}/forzar-envio`, { decidedBy: "panel" })}
                >
                  Forzar envío a Dropi
                </PrimaryButton>
              )}
              {(selected.category === "QUANTITY_REVIEW" || selected.category === "CUSTOMER_RISK_REVIEW") && (
                <div className="flex gap-2">
                  <PrimaryButton
                    disabled={busy}
                    onClick={() =>
                      callEndpoint(
                        `/api/pedidos/${selected.orderId}/${
                          selected.category === "QUANTITY_REVIEW" ? "revision-cantidad" : "revision-riesgo-cliente"
                        }`,
                        { decision: "APPROVED", decidedBy: "panel" },
                      )
                    }
                  >
                    Aprobar
                  </PrimaryButton>
                  <SecondaryButton
                    disabled={busy}
                    onClick={() =>
                      callEndpoint(
                        `/api/pedidos/${selected.orderId}/${
                          selected.category === "QUANTITY_REVIEW" ? "revision-cantidad" : "revision-riesgo-cliente"
                        }`,
                        { decision: "REJECTED", decidedBy: "panel" },
                      )
                    }
                  >
                    Rechazar
                  </SecondaryButton>
                </div>
              )}
              {selected.category === "UNCONFIRMED_HISTORY" && (
                <div className="flex gap-2">
                  <PrimaryButton
                    disabled={busy}
                    onClick={() =>
                      callEndpoint(`/api/historial-no-confirmados/${selected.orderId}`, {
                        action: "approve-inject",
                        decidedBy: "panel",
                      })
                    }
                  >
                    Aprobar e inyectar
                  </PrimaryButton>
                  <SecondaryButton
                    disabled={busy}
                    onClick={() =>
                      callEndpoint(`/api/historial-no-confirmados/${selected.orderId}`, {
                        action: "delete",
                        decidedBy: "panel",
                      })
                    }
                  >
                    Eliminar
                  </SecondaryButton>
                </div>
              )}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
