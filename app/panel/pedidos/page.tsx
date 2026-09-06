"use client";

import { useEffect, useState } from "react";
import { TopBar } from "../_components/topbar";
import { Card, Dot } from "../_components/ui";

type KanbanOrder = {
  id: string;
  shopifyOrderName: string;
  status: string;
  totalQuantity: number;
  totalPrice: string;
  currency: string;
  semaphore: "green" | "yellow" | "red";
  telegramChatId: string | null;
  reminder1SentAt: string | null;
  reminder2SentAt: string | null;
  reminder3SentAt: string | null;
};

const COLUMN_ORDER = [
  { status: "PENDING_CONFIRMATION", label: "Por confirmar", color: "slate" as const },
  { status: "QUANTITY_REVIEW", label: "Revisión cantidad", color: "amber" as const },
  { status: "CUSTOMER_RISK_REVIEW", label: "Riesgo cliente", color: "violet" as const },
  { status: "PAUSED_ZONE_BLOCKED", label: "Zona bloqueada", color: "orange" as const },
  { status: "CONFIRMED", label: "Confirmado", color: "blue" as const },
  { status: "SENT_TO_DROPI", label: "En Dropi", color: "green" as const },
  { status: "CANCELLED_NOT_CONFIRMED", label: "Canceló (no confirmó)", color: "slate" as const },
  { status: "CANCELLED_MANUAL", label: "Cancelado", color: "slate" as const },
  { status: "CANCELLED_DELIVERY_INCIDENT", label: "Canceló (incidencia)", color: "slate" as const },
  { status: "BLOCKED_QUANTITY", label: "Bloqueado (cantidad)", color: "red" as const },
];

const SEMAPHORE_COLOR: Record<string, string> = { green: "#16a34a", yellow: "#d97706", red: "#dc2626" };

export default function PedidosPage() {
  const [byStatus, setByStatus] = useState<Record<string, KanbanOrder[]>>({});
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(true);

  function load() {
    fetch(`/api/pedidos?days=${days}`)
      .then((r) => r.json())
      .then((json) => setByStatus(json.byStatus ?? {}))
      .finally(() => setLoading(false));
  }

  useEffect(load, [days]);

  async function sendReminder(orderId: string, stage: 1 | 2 | 3) {
    await fetch(`/api/pedidos/${orderId}/recordatorio-telegram`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage }),
    });
    load();
  }

  const total = Object.values(byStatus).reduce((sum, arr) => sum + arr.length, 0);

  return (
    <div>
      <TopBar title="Pedidos" subtitle="Consulta y administra todas las órdenes." />

      <div className="mb-4 flex items-center gap-2">
        {[1, 7, 30].map((d) => (
          <button
            key={d}
            onClick={() => {
              setLoading(true);
              setDays(d);
            }}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
              days === d ? "bg-blue-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"
            }`}
          >
            {d === 1 ? "Hoy" : `${d} días`}
          </button>
        ))}
        <span className="ml-2 text-sm text-slate-500">{total} pedidos</span>
      </div>

      {loading ? (
        <p className="text-sm text-slate-400">Cargando…</p>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {COLUMN_ORDER.map((col) => {
            const orders = byStatus[col.status] ?? [];
            return (
              <Card key={col.status} className="w-64 flex-shrink-0 p-3">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <Dot color={col.color} /> {col.label}
                  <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                    {orders.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {orders.length === 0 ? (
                    <p className="text-xs text-slate-400">Sin pedidos.</p>
                  ) : (
                    orders.map((o) => (
                      <div key={o.id} className="rounded-lg border border-slate-100 p-2.5 text-xs">
                        <div className="mb-1 flex items-center justify-between">
                          <span className="font-semibold text-slate-800">{o.shopifyOrderName}</span>
                          <span style={{ color: SEMAPHORE_COLOR[o.semaphore] }}>●</span>
                        </div>
                        <div className="text-slate-500">
                          {o.totalQuantity} u. — {o.totalPrice} {o.currency}
                        </div>
                        {o.status === "SENT_TO_DROPI" && o.telegramChatId && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            <button
                              disabled={!!o.reminder1SentAt}
                              onClick={() => sendReminder(o.id, 1)}
                              className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 disabled:opacity-40"
                            >
                              Aviso 1
                            </button>
                            <button
                              disabled={!!o.reminder2SentAt}
                              onClick={() => sendReminder(o.id, 2)}
                              className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 disabled:opacity-40"
                            >
                              Aviso 2
                            </button>
                            <button
                              disabled={!!o.reminder3SentAt}
                              onClick={() => sendReminder(o.id, 3)}
                              className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 disabled:opacity-40"
                            >
                              Aviso 3
                            </button>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
