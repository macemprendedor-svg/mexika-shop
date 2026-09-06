"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, RefreshCw } from "lucide-react";
import { TopBar } from "../_components/topbar";
import { Card, SecondaryButton } from "../_components/ui";

type Integration = { name: string; connected: boolean; detail?: string };

export default function IntegracionesPage() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);

  function load() {
    fetch("/api/panel/integraciones-estado")
      .then((r) => r.json())
      .then((json) => setIntegrations(json.integrations ?? []))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  function reload() {
    setLoading(true);
    load();
  }

  const allOk = integrations.length > 0 && integrations.every((i) => i.connected);

  return (
    <div>
      <TopBar title="Monitor de integraciones" subtitle="Estado en tiempo real de los servicios que este sistema llama directamente." />

      <Card className={`mb-6 flex items-center justify-between p-4 ${allOk ? "bg-green-50" : ""}`}>
        <div className="flex items-center gap-2">
          {allOk ? <CheckCircle2 className="text-green-600" size={20} /> : <XCircle className="text-red-500" size={20} />}
          <span className="font-semibold text-slate-800">
            {loading ? "Revisando…" : allOk ? "Todos los sistemas operando" : "Hay al menos una integración con problemas"}
          </span>
        </div>
        <SecondaryButton onClick={reload}>
          <span className="flex items-center gap-1">
            <RefreshCw size={14} /> Revisar de nuevo
          </span>
        </SecondaryButton>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {integrations.map((i) => (
          <Card key={i.name} className="p-4">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-800">{i.name}</span>
              {i.connected ? (
                <span className="flex items-center gap-1 text-sm text-green-600">
                  <CheckCircle2 size={14} /> Conectado
                </span>
              ) : (
                <span className="flex items-center gap-1 text-sm text-red-600">
                  <XCircle size={14} /> Desconectado
                </span>
              )}
            </div>
            {i.detail && <p className="mt-1 text-xs text-slate-400">{i.detail}</p>}
          </Card>
        ))}
      </div>

      <p className="mt-6 text-xs text-slate-400">
        Dropi y Releasit no aparecen aquí: este sistema no hace llamadas directas a ninguno de los dos (Dropi
        no expone una API REST completa; Releasit corre dentro del checkout de Shopify).
      </p>
    </div>
  );
}
