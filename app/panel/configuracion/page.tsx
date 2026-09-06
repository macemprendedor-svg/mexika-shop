"use client";

import { useEffect, useState } from "react";
import { Mail, Clock, Smartphone, Ban, Package, ShieldOff } from "lucide-react";
import { TopBar } from "../_components/topbar";
import { Card, PrimaryButton } from "../_components/ui";

export default function ConfiguracionPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"loading" | "idle" | "saving" | "saved" | "error">("loading");

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((json) => {
        setEmail(json.dropiSupportEmail ?? "");
        setStatus("idle");
      })
      .catch(() => setStatus("error"));
  }, []);

  async function save() {
    setStatus("saving");
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dropiSupportEmail: email }),
      });
      if (!res.ok) throw new Error();
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div>
      <TopBar title="Configuración" subtitle="Reglas, automatizaciones y valores editables del sistema." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <h2 className="mb-1 flex items-center gap-2 font-semibold text-slate-900">
            <Mail size={16} className="text-blue-500" /> Correo de soporte de Dropi
          </h2>
          <p className="mb-3 text-sm text-slate-500">
            A donde se mandan los reportes de rechazo falso. Puede ser tu propio correo si Dropi no te dio uno
            — copia y pega el contenido en su chat de soporte en vivo. Editable aquí, sin redeploy.
          </p>
          <div className="flex gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="correo@ejemplo.com"
              className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
            />
            <PrimaryButton onClick={save} disabled={status === "saving"}>
              Guardar
            </PrimaryButton>
          </div>
          {status === "saved" && <p className="mt-2 text-sm text-green-600">Guardado.</p>}
          {status === "error" && <p className="mt-2 text-sm text-red-600">Ocurrió un error.</p>}
        </Card>

        <Card className="p-5">
          <h2 className="mb-3 font-semibold text-slate-900">Flujo de confirmación (fijo)</h2>
          <p className="mb-3 text-xs text-slate-500">
            Estas reglas están en el código, no son editables desde aquí todavía — cambiar los tiempos
            requeriría un ajuste de código y un deploy.
          </p>
          <ol className="space-y-3 text-sm">
            <Step icon={Mail} title="Correo 1 · Inmediato" desc="Se envía incluso en horario nocturno." />
            <Step icon={Clock} title="Correo 2 · Después de 1 hora" desc="Solo si no ha confirmado." />
            <Step icon={Smartphone} title="SMS · Hasta 4 horas" desc="Ventana se acorta después de las 5pm; nunca entre 10pm–8am." />
            <Step icon={Ban} title="Cancelación automática" desc="Si no confirma tras el SMS." />
          </ol>
        </Card>

        <Card className="p-5 lg:col-span-2">
          <h2 className="mb-3 flex items-center gap-2 font-semibold text-slate-900">
            <Package size={16} className="text-blue-500" /> Filtro por cantidad (fijo)
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <RuleCard color="green" title="1 unidad" desc="Automático a Dropi" />
            <RuleCard color="amber" title="2–3 unidades" desc="Revisión humana" />
            <RuleCard color="red" title="Más de 3 unidades" desc="Bloqueado" />
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="mb-3 flex items-center gap-2 font-semibold text-slate-900">
            <ShieldOff size={16} className="text-blue-500" /> Bloqueo de zonas (fijo)
          </h2>
          <ul className="space-y-2 text-sm text-slate-600">
            <li>• Combo CP + transportadora: bloqueo automático con más de 3 rechazos falsos.</li>
            <li>• Transportadora sola en ≥2 CPs: bloqueo con más de 10 rechazos falsos.</li>
            <li>• Bloqueos manuales desde Riesgo COD siempre disponibles.</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}

function Step({ icon: Icon, title, desc }: { icon: React.ComponentType<{ size?: number }>; title: string; desc: string }) {
  return (
    <li className="flex gap-3">
      <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
        <Icon size={14} />
      </div>
      <div>
        <div className="font-medium text-slate-800">{title}</div>
        <div className="text-xs text-slate-500">{desc}</div>
      </div>
    </li>
  );
}

function RuleCard({ color, title, desc }: { color: "green" | "amber" | "red"; title: string; desc: string }) {
  const colors = {
    green: "bg-green-50 text-green-700 ring-green-600/10",
    amber: "bg-amber-50 text-amber-700 ring-amber-600/10",
    red: "bg-red-50 text-red-700 ring-red-600/10",
  };
  return (
    <div className={`rounded-lg p-3 ring-1 ring-inset ${colors[color]}`}>
      <div className="font-semibold">{title}</div>
      <div className="text-xs">{desc}</div>
    </div>
  );
}
