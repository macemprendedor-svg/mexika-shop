"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  AlertTriangle,
  Package,
  Truck,
  ShieldCheck,
  Users,
  BarChart3,
  Plug,
  Settings,
} from "lucide-react";
import { useEffect, useState } from "react";

const NAV_ITEMS = [
  { href: "/panel", label: "Inicio", icon: Home },
  { href: "/panel/acciones", label: "Acciones pendientes", icon: AlertTriangle, countKey: "exceptions" as const },
  { href: "/panel/pedidos", label: "Pedidos", icon: Package },
  { href: "/panel/tracking", label: "Tracking", icon: Truck },
  { href: "/panel/riesgo", label: "Riesgo COD", icon: ShieldCheck },
  { href: "/panel/proveedores", label: "Proveedores", icon: Users },
  { href: "/panel/analitica", label: "Analítica", icon: BarChart3 },
  { href: "/panel/integraciones", label: "Integraciones", icon: Plug },
  { href: "/panel/configuracion", label: "Configuración", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const [exceptionsCount, setExceptionsCount] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/excepciones")
      .then((r) => r.json())
      .then((json) => setExceptionsCount((json.items ?? []).length))
      .catch(() => setExceptionsCount(null));
  }, [pathname]);

  return (
    <aside className="flex h-screen w-60 flex-shrink-0 flex-col bg-[#0B1220] text-slate-300">
      <div className="px-5 py-6">
        <div className="text-xl font-extrabold tracking-tight text-white">MEXIKA</div>
        <div className="text-xs font-medium text-slate-400">Control COD</div>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {NAV_ITEMS.map((item) => {
          const active = item.href === "/panel" ? pathname === "/panel" : pathname.startsWith(item.href);
          const Icon = item.icon;
          const count = item.countKey === "exceptions" ? exceptionsCount : null;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-white/5 hover:text-white"
              }`}
            >
              <span className="flex items-center gap-3">
                <Icon size={17} strokeWidth={2} />
                {item.label}
              </span>
              {!!count && (
                <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[11px] font-bold text-white">
                  {count}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="m-3 rounded-xl bg-white/5 p-4 text-xs text-slate-300">
        <p className="font-semibold text-white">Fase 1–4 en construcción</p>
        <p className="mt-1 text-slate-400">
          Datos reales aparecerán aquí en cuanto entren pedidos de verdad.
        </p>
      </div>
    </aside>
  );
}
