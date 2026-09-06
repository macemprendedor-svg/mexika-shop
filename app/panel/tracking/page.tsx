"use client";

import { useEffect, useState } from "react";
import { Truck, HelpCircle, Radio } from "lucide-react";
import { TopBar } from "../_components/topbar";
import { Card, KpiCard, Badge } from "../_components/ui";

type InTransitOrder = { id: string; shopifyOrderName: string; markedPaidAt: string | null };
type RawEvent = { id: string; status: string | null; message: string | null; shopifyOrderId: string | null; createdAt: string };
type OpenIncident = {
  id: string;
  postalCode: string;
  rawStatus: string | null;
  createdAt: string;
  order: { shopifyOrderName: string };
};

export default function TrackingPage() {
  const [inTransit, setInTransit] = useState<InTransitOrder[]>([]);
  const [rawEvents, setRawEvents] = useState<RawEvent[]>([]);
  const [openIncidents, setOpenIncidents] = useState<OpenIncident[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/panel/tracking")
      .then((r) => r.json())
      .then((json) => {
        setInTransit(json.inTransit ?? []);
        setRawEvents(json.rawEvents ?? []);
        setOpenIncidents(json.openIncidents ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <TopBar title="Centro de tracking" subtitle="Supervisa cada envío una vez que sale a Dropi." />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard icon={Truck} label="En Dropi" value={inTransit.length} color="blue" />
        <KpiCard icon={HelpCircle} label="Entrega cuestionada (abiertas)" value={openIncidents.length} color="violet" />
        <KpiCard icon={Radio} label="Eventos de transportadora capturados" value={rawEvents.length} color="slate" />
      </div>

      {rawEvents.length === 0 && (
        <Card className="mb-6 border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Todavía no ha llegado ningún evento real de transportadora (Dropi → Shopify → aquí). En cuanto un
          pedido real avance en Dropi, aparecerán aquí y se podrá construir la detección automática de
          entrega cuestionada sobre datos reales en vez de suposiciones.
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-3 font-semibold text-slate-900">Pedidos en Dropi</h2>
          {loading ? (
            <p className="text-sm text-slate-400">Cargando…</p>
          ) : inTransit.length === 0 ? (
            <p className="text-sm text-slate-400">Sin pedidos en tránsito.</p>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {inTransit.map((o) => (
                <li key={o.id} className="flex items-center justify-between py-2">
                  <span className="font-medium text-slate-800">{o.shopifyOrderName}</span>
                  <span className="text-xs text-slate-400">
                    {o.markedPaidAt ? new Date(o.markedPaidAt).toLocaleString("es-MX") : "—"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="mb-3 font-semibold text-slate-900">Entrega cuestionada — abiertas</h2>
          {openIncidents.length === 0 ? (
            <p className="text-sm text-slate-400">Sin incidencias abiertas.</p>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {openIncidents.map((inc) => (
                <li key={inc.id} className="py-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-800">{inc.order.shopifyOrderName}</span>
                    <Badge color="violet">Esperando respuesta</Badge>
                  </div>
                  <div className="text-xs text-slate-400">CP {inc.postalCode}</div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5 lg:col-span-2">
          <h2 className="mb-3 font-semibold text-slate-900">Eventos crudos capturados (para inspección)</h2>
          {rawEvents.length === 0 ? (
            <p className="text-sm text-slate-400">Nada capturado todavía.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-1 text-left">Fecha</th>
                  <th className="py-1 text-left">Status</th>
                  <th className="py-1 text-left">Mensaje</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rawEvents.map((e) => (
                  <tr key={e.id}>
                    <td className="py-2 text-xs text-slate-500">{new Date(e.createdAt).toLocaleString("es-MX")}</td>
                    <td className="py-2">{e.status ?? "—"}</td>
                    <td className="py-2 text-slate-600">{e.message ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </div>
  );
}
