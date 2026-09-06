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

const sectionStyle: React.CSSProperties = { margin: "32px 0" };
const tableStyle: React.CSSProperties = { width: "100%", borderCollapse: "collapse", marginTop: 12 };
const cellStyle: React.CSSProperties = { border: "1px solid #ddd", padding: "6px 10px", textAlign: "left" };

export default function PanelPage() {
  return (
    <main style={{ maxWidth: 900, margin: "40px auto", padding: 16, fontFamily: "system-ui" }}>
      <h1>Panel — mexika-shop</h1>
      <SettingsSection />
      <BlockedZonesSection />
      <RiskRankingSection />
    </main>
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
