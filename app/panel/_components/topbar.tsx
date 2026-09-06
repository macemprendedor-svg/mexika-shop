import { Search, Bell } from "lucide-react";

export function TopBar({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        <p className="text-sm text-slate-500">{subtitle}</p>
      </div>
      <div className="flex items-center gap-4">
        <div className="relative hidden sm:block">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar pedido, teléfono o cliente…"
            className="w-72 rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none"
          />
        </div>
        <button className="relative rounded-full p-2 text-slate-500 hover:bg-slate-100" aria-label="Notificaciones">
          <Bell size={18} />
        </button>
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
            V
          </div>
          <div className="hidden text-xs sm:block">
            <div className="font-semibold text-slate-800">Vendedor</div>
            <div className="text-slate-400">mexika-shop</div>
          </div>
        </div>
      </div>
    </div>
  );
}
