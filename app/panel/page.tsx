"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Package, AlertTriangle, CheckCircle2, Send, ArrowRight } from "lucide-react";
import { TopBar } from "./_components/topbar";
import { Card, KpiCard, Badge, Dot } from "./_components/ui";
import { EXCEPTION_META, formatAge, type ExceptionCategory } from "./_components/exception-meta";

type Exception = {
  orderId: string;
  orderName: string;
  category: ExceptionCategory;
  reason: string;
  ageMinutes: number;
};

type Integration = { name: string; connected: boolean };

type Resumen = {
  ordersToday: number;
  exceptionsCount: number;
  confirmationRate: number | null;
  sentToDropiToday: number;
};

const STATUS_COLUMNS = [
  { status: "PENDING_CONFIRMATION", label: "Por confirmar", color: "slate" as const },
  { status: "QUANTITY_REVIEW", label: "Revisión", color: "amber" as const },
  { status: "SENT_TO_DROPI", label: "En Dropi", color: "blue" as const },
];

export default function PanelHomePage() {
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [exceptions, setExceptions] = useState<Exception[]>([]);
  const [byStatus, setByStatus] = useState<Record<string, { id: string; shopifyOrderName: string }[]>>({});
  const [loadingIntegrations, setLoadingIntegrations] = useState(true);

  useEffect(() => {
    fetch("/api/panel/resumen").then((r) => r.json()).then(setResumen);
    fetch("/api/excepciones").then((r) => r.json()).then((j) => setExceptions((j.items ?? []).slice(0, 5)));
    fetch("/api/pedidos?days=1").then((r) => r.json()).then((j) => setByStatus(j.byStatus ?? {}));
    fetch("/api/panel/integraciones-estado")
      .then((r) => r.json())
      .then((j) => setIntegrations(j.integrations ?? []))
      .finally(() => setLoadingIntegrations(false));
  }, []);

  const today = new Date().toLocaleDateString("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div>
      <TopBar title="Centro de operaciones COD" subtitle={today} />

      <Card className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 text-sm">
        {loadingIntegrations ? (
          <span className="text-slate-400">Revisando integraciones…</span>
        ) : (
          integrations.map((i) => (
            <span key={i.name} className="flex items-center gap-1.5 text-slate-600">
              <Dot color={i.connected ? "green" : "red"} />
              {i.name} <span className="text-slate-400">{i.connected ? "Conectado" : "Desconectado"}</span>
            </span>
          ))
        )}
        <span className="ml-auto text-xs text-slate-400">Dropi y Releasit no se monitorean aquí — no exponen API</span>
      </Card>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard icon={Package} label="Pedidos hoy" value={resumen?.ordersToday ?? "—"} color="blue" />
        <KpiCard
          icon={AlertTriangle}
          label="Requieren acción"
          value={resumen?.exceptionsCount ?? "—"}
          color="red"
        />
        <KpiCard
          icon={CheckCircle2}
          label="Tasa de confirmación (7d)"
          value={resumen?.confirmationRate != null ? `${resumen.confirmationRate}%` : "—"}
          color="green"
        />
        <KpiCard icon={Send} label="Enviados a Dropi hoy" value={resumen?.sentToDropiToday ?? "—"} color="violet" />
      </div>

      <Card className="mb-6 p-5">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="flex items-center gap-2 font-semibold text-slate-900">
              <AlertTriangle size={16} className="text-red-500" /> Acciones pendientes
            </h2>
            <p className="text-xs text-slate-500">Pedidos que requieren tu atención, ordenados por prioridad.</p>
          </div>
          <Link href="/panel/acciones" className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline">
            Ver todas <ArrowRight size={14} />
          </Link>
        </div>
        {exceptions.length === 0 ? (
          <p className="py-4 text-sm text-slate-400">Sin excepciones pendientes.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {exceptions.map((e) => {
              const meta = EXCEPTION_META[e.category];
              return (
                <div key={e.orderId + e.category} className="flex items-center justify-between py-2.5 text-sm">
                  <div className="flex items-center gap-3">
                    <Badge color={meta.badgeColor}>{meta.label}</Badge>
                    <span className="font-semibold text-slate-800">{e.orderName}</span>
                    <span className="text-slate-500">{e.reason}</span>
                  </div>
                  <span className="text-xs text-slate-400">{formatAge(e.ageMinutes)}</span>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="flex items-center gap-2 font-semibold text-slate-900">
              <Package size={16} className="text-blue-500" /> Pedidos de hoy
            </h2>
            <p className="text-xs text-slate-500">Flujo de pedidos en tiempo real.</p>
          </div>
          <Link href="/panel/pedidos" className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline">
            Ver todos <ArrowRight size={14} />
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {STATUS_COLUMNS.map((col) => {
            const orders = byStatus[col.status] ?? [];
            return (
              <div key={col.status} className="rounded-lg border border-slate-100 p-3">
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-600">
                  <Dot color={col.color} /> {col.label} ({orders.length})
                </div>
                {orders.length === 0 ? (
                  <p className="text-xs text-slate-400">Sin pedidos.</p>
                ) : (
                  <ul className="space-y-1">
                    {orders.slice(0, 4).map((o) => (
                      <li key={o.id} className="text-xs text-slate-700">
                        {o.shopifyOrderName}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
