import { Users } from "lucide-react";
import { TopBar } from "../_components/topbar";
import { Card } from "../_components/ui";

export default function ProveedoresPage() {
  return (
    <div>
      <TopBar title="Proveedores y transportadoras" subtitle="Compara cumplimiento, velocidad y rentabilidad." />

      <Card className="flex flex-col items-center gap-3 p-12 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
          <Users size={26} />
        </div>
        <h2 className="font-semibold text-slate-800">Todavía no hay datos suficientes</h2>
        <p className="max-w-md text-sm text-slate-500">
          Este ranking necesita saber qué proveedor y transportadora atendió cada pedido — Dropi no expone
          esa información vía API REST, y Shopify/Dropify tampoco la reflejan hoy. En cuanto empecemos a
          capturar eventos reales de transportadora (ver <em>Tracking</em>), construimos este ranking sobre
          datos de verdad en vez de simularlo.
        </p>
        <p className="text-sm text-slate-500">
          Mientras tanto, el <a href="/panel/riesgo" className="text-blue-600 hover:underline">ranking de zonas de
          riesgo</a> en Riesgo COD ya funciona con los rechazos falsos que sí detectamos.
        </p>
      </Card>
    </div>
  );
}
