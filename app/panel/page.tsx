"use client";

import { useEffect, useState } from "react";

type BlockedZone = {
  id: string;
  postalCode: string | null;
  municipality: string | null;
  carrierName: string | null;
  reason: string;
  incidentsReference: number;
  createdAt: string;
};

type RiskRow = {
  postalCode: string;
  municipality: string | null;
  carrierName: string | null;
  totalIncidents: number;
  falseRejections: number;
};

type ExceptionItem = {
  orderId: string;
  orderName: string;
  category: string;
  reason: string;
  recommendedAction: string;
  ageMinutes: number;
  severity: "red" | "yellow";
};

type KanbanOrder = {
  id: string;
  shopifyOrderName: string;
  status: string;
  totalQuantity: number;
  totalPrice: string;
  currency: string;
  semaphore: "green" | "yellow" | "red";
};

type UnconfirmedOrder = {
  id: string;
  shopifyOrderName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  totalQuantity: number;
  cancelledAt: string | null;
  cancelReason: string | null;
};

const SEMAPHORE_COLOR: Record<string, string> = { green: "#2e7d32", yellow: "#b8860b", red: "#c62828" };

const sectionStyle: React.CSSProperties = { margin: "32px 0" };
const tableStyle: React.CSSProperties = { width: "100%", borderCollapse: "collapse", marginTop: 12 };
const cellStyle: React.CSSProperties = { border: "1px solid #ddd", padding: "6px 10px", textAlign: "left" };

export default function PanelPage() {
  return (
    <main style={{ maxWidth: 900, margin: "40px auto", padding: 16, fontFamily: "system-ui" }}>
      <h1>Panel — mexika-shop</h1>
      <ExceptionsSection />
      <KanbanSection />
      <UnconfirmedHistorySection />
      <SettingsSection />
      <BlockedZonesSection />
      <RiskRankingSection />
    </main>
  );
}

function ExceptionsSection() {
  const [items, setItems] = useState<ExceptionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  function load() {
    setLoading(true);
    fetch("/api/excepciones")
      .then((r) => r.json())
      .then((json) => setItems(json.items ?? []))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function act(orderId: string, path: string) {
    setBusy(orderId);
    try {
      await fetch(`/api/pedidos/${orderId}/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decidedBy: "panel" }),
      });
    } finally {
      setBusy(null);
      load();
    }
  }

  return (
    <section style={sectionStyle}>
      <h2>Bandeja de excepciones</h2>
      <p style={{ color: "#666" }}>Qué pedido necesita acción humana, por qué, y qué hacer.</p>
      {loading ? (
        <p>Cargando…</p>
      ) : items.length === 0 ? (
        <p>Sin excepciones pendientes.</p>
      ) : (
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={cellStyle}></th>
              <th style={cellStyle}>Pedido</th>
              <th style={cellStyle}>Motivo</th>
              <th style={cellStyle}>Acción recomendada</th>
              <th style={cellStyle}>Edad</th>
              <th style={cellStyle}></th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.orderId + it.category}>
                <td style={{ ...cellStyle, color: SEMAPHORE_COLOR[it.severity] }}>●</td>
                <td style={cellStyle}>{it.orderName}</td>
                <td style={cellStyle}>{it.reason}</td>
                <td style={cellStyle}>{it.recommendedAction}</td>
                <td style={cellStyle}>{it.ageMinutes} min</td>
                <td style={cellStyle}>
                  {it.category === "STUCK_BEFORE_DROPI" && (
                    <button disabled={busy === it.orderId} onClick={() => act(it.orderId, "reintentar-dropi")}>
                      Reintentar
                    </button>
                  )}
                  {it.category === "ZONE_BLOCKED" && (
                    <button disabled={busy === it.orderId} onClick={() => act(it.orderId, "forzar-envio")}>
                      Forzar envío
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function KanbanSection() {
  const [byStatus, setByStatus] = useState<Record<string, KanbanOrder[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/pedidos?days=7")
      .then((r) => r.json())
      .then((json) => setByStatus(json.byStatus ?? {}))
      .finally(() => setLoading(false));
  }, []);

  const statuses = Object.keys(byStatus);

  return (
    <section style={sectionStyle}>
      <h2>Pedidos (últimos 7 días)</h2>
      {loading ? (
        <p>Cargando…</p>
      ) : statuses.length === 0 ? (
        <p>Sin pedidos en este periodo.</p>
      ) : (
        <div style={{ display: "flex", gap: 16, overflowX: "auto" }}>
          {statuses.map((status) => (
            <div key={status} style={{ minWidth: 220, flexShrink: 0 }}>
              <h3 style={{ fontSize: 14 }}>
                {status} ({byStatus[status].length})
              </h3>
              {byStatus[status].map((o) => (
                <div
                  key={o.id}
                  style={{ border: "1px solid #ddd", borderRadius: 6, padding: 8, marginBottom: 6, fontSize: 13 }}
                >
                  <span style={{ color: SEMAPHORE_COLOR[o.semaphore] }}>●</span> {o.shopifyOrderName}
                  <br />
                  {o.totalQuantity} u. — {o.totalPrice} {o.currency}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function UnconfirmedHistorySection() {
  const [orders, setOrders] = useState<UnconfirmedOrder[]>([]);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    fetch("/api/historial-no-confirmados")
      .then((r) => r.json())
      .then((json) => setOrders(json.orders ?? []))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function act(id: string, action: "approve-inject" | "delete") {
    await fetch(`/api/historial-no-confirmados/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, decidedBy: "panel" }),
    });
    load();
  }

  return (
    <section style={sectionStyle}>
      <h2>Historial de no confirmados</h2>
      {loading ? (
        <p>Cargando…</p>
      ) : orders.length === 0 ? (
        <p>No hay pedidos sin confirmar.</p>
      ) : (
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={cellStyle}>Pedido</th>
              <th style={cellStyle}>Contacto</th>
              <th style={cellStyle}>Cantidad</th>
              <th style={cellStyle}></th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td style={cellStyle}>{o.shopifyOrderName}</td>
                <td style={cellStyle}>{o.customerEmail ?? o.customerPhone ?? "—"}</td>
                <td style={cellStyle}>{o.totalQuantity}</td>
                <td style={cellStyle}>
                  <button onClick={() => act(o.id, "approve-inject")}>Aprobar e inyectar</button>{" "}
                  <button onClick={() => act(o.id, "delete")}>Eliminar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function SettingsSection() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "saving" | "saved" | "error">("idle");

  useEffect(() => {
    setStatus("loading");
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
    <section style={sectionStyle}>
      <h2>Configuración</h2>
      <label style={{ display: "block", marginBottom: 6 }}>
        Correo de soporte de Dropi (a donde se mandan los reportes de rechazo falso — puede ser tu
        propio correo si Dropi no te dio uno, para copiar/pegar en su chat de soporte en vivo):
      </label>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="correo@ejemplo.com"
          style={{ flex: 1, padding: 6 }}
        />
        <button onClick={save} disabled={status === "saving"}>
          Guardar
        </button>
      </div>
      {status === "saved" && <p style={{ color: "green" }}>Guardado.</p>}
      {status === "error" && <p style={{ color: "crimson" }}>Ocurrió un error.</p>}
    </section>
  );
}

function BlockedZonesSection() {
  const [zones, setZones] = useState<BlockedZone[]>([]);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    fetch("/api/zonas-bloqueadas")
      .then((r) => r.json())
      .then((json) => setZones(json.zones ?? []))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function unblock(id: string) {
    await fetch(`/api/zonas-bloqueadas/${id}/desbloquear`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reactivatedBy: "panel" }),
    });
    load();
  }

  return (
    <section style={sectionStyle}>
      <h2>Zonas / transportadoras bloqueadas</h2>
      {loading ? (
        <p>Cargando…</p>
      ) : zones.length === 0 ? (
        <p>No hay bloqueos activos.</p>
      ) : (
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={cellStyle}>CP</th>
              <th style={cellStyle}>Municipio</th>
              <th style={cellStyle}>Transportadora</th>
              <th style={cellStyle}>Motivo</th>
              <th style={cellStyle}></th>
            </tr>
          </thead>
          <tbody>
            {zones.map((z) => (
              <tr key={z.id}>
                <td style={cellStyle}>{z.postalCode ?? "Cualquiera"}</td>
                <td style={cellStyle}>{z.municipality ?? "—"}</td>
                <td style={cellStyle}>{z.carrierName ?? "Cualquiera"}</td>
                <td style={cellStyle}>{z.reason}</td>
                <td style={cellStyle}>
                  <button onClick={() => unblock(z.id)}>Desbloquear</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function RiskRankingSection() {
  const [rows, setRows] = useState<RiskRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/zonas-riesgo")
      .then((r) => r.json())
      .then((json) => setRows(json.ranking ?? []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section style={sectionStyle}>
      <h2>Ranking de zonas de riesgo</h2>
      {loading ? (
        <p>Cargando…</p>
      ) : rows.length === 0 ? (
        <p>Todavía no hay incidentes registrados.</p>
      ) : (
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={cellStyle}>CP</th>
              <th style={cellStyle}>Municipio</th>
              <th style={cellStyle}>Transportadora</th>
              <th style={cellStyle}>Rechazos falsos</th>
              <th style={cellStyle}>Total incidentes</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td style={cellStyle}>{r.postalCode}</td>
                <td style={cellStyle}>{r.municipality ?? "—"}</td>
                <td style={cellStyle}>{r.carrierName ?? "—"}</td>
                <td style={cellStyle}>{r.falseRejections}</td>
                <td style={cellStyle}>{r.totalIncidents}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
