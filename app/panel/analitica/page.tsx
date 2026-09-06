"use client";

import { useEffect, useState } from "react";
import { Package, CheckCircle2, ShieldAlert } from "lucide-react";
import { TopBar } from "../_components/topbar";
import { Card, KpiCard } from "../_components/ui";

type Analitica = {
  ordersByDay: { date: string; count: number }[];
  confirmedByChannel: { EMAIL: number; SMS: number; MANUAL: number };
  confirmationRate: number | null;
  totalOrders: number;
  falseRejections: number;
};

export default function AnaliticaPage() {
  const [data, setData] = useState<Analitica | null>(null);

  useEffect(() => {
    fetch("/api/panel/analitica").then((r) => r.json()).then(setData);
  }, []);

  const maxDay = data ? Math.max(1, ...data.ordersByDay.map((d) => d.count)) : 1;
  const channelTotal = data
    ? data.confirmedByChannel.EMAIL + data.confirmedByChannel.SMS + data.confirmedByChannel.MANUAL
    : 0;

  return (
    <div>
      <TopBar title="Analítica COD" subtitle="Solo métricas que medimos de verdad — sin utilidad ni costos (no los rastreamos aún)." />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard icon={Package} label="Pedidos (14 días)" value={data?.totalOrders ?? "—"} color="blue" />
        <KpiCard
          icon={CheckCircle2}
          label="Tasa de confirmación"
          value={data?.confirmationRate != null ? `${data.confirmationRate}%` : "—"}
          color="green"
        />
        <KpiCard icon={ShieldAlert} label="Rechazos falsos totales" value={data?.falseRejections ?? "—"} color="red" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-4 font-semibold text-slate-900">Pedidos por día</h2>
          {!data || data.ordersByDay.length === 0 ? (
            <p className="text-sm text-slate-400">Sin datos todavía.</p>
          ) : (
            <div className="flex h-40 items-end gap-1.5">
              {data.ordersByDay.map((d) => (
                <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
                  <div
                    className="w-full rounded-t bg-blue-500"
                    style={{ height: `${Math.max(4, (d.count / maxDay) * 130)}px` }}
                    title={`${d.date}: ${d.count}`}
                  />
                  <span className="text-[9px] text-slate-400">{d.date.slice(5)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 font-semibold text-slate-900">Canal de confirmación</h2>
          {!data || channelTotal === 0 ? (
            <p className="text-sm text-slate-400">Sin confirmaciones todavía.</p>
          ) : (
            <div className="space-y-3">
              {(["EMAIL", "SMS", "MANUAL"] as const).map((ch) => {
                const value = data.confirmedByChannel[ch];
                const pct = Math.round((value / channelTotal) * 100);
                return (
                  <div key={ch}>
                    <div className="mb-1 flex justify-between text-xs text-slate-600">
                      <span>{ch}</span>
                      <span>{pct}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100">
                      <div className="h-2 rounded-full bg-blue-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
