"use client";

import { useState } from "react";

export function ReportActions({ token }: { token: string }) {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");

  async function report() {
    setStatus("loading");
    try {
      const res = await fetch(`/api/seguimiento/${token}/reportar-no-visitaron`, { method: "POST" });
      if (!res.ok) throw new Error();
      setStatus("done");
    } catch {
      setStatus("error");
    }
  }

  if (status === "done") {
    return <p style={{ fontWeight: "bold" }}>Recibido — vamos a revisar qué pasó con la transportadora.</p>;
  }

  return (
    <div style={{ marginTop: 24 }}>
      <button onClick={report} disabled={status === "loading"}>
        Reportar que no visitaron mi domicilio
      </button>
      {status === "error" && <p style={{ color: "crimson" }}>Ocurrió un error, intenta de nuevo.</p>}
    </div>
  );
}
