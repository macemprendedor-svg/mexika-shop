"use client";

import { useState } from "react";

export function ConfirmActions({ token }: { token: string }) {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function act(action: "confirm" | "cancel") {
    setStatus("loading");
    setMessage(null);
    try {
      const via = new URLSearchParams(window.location.search).get("via") ?? "email";
      const res = await fetch(`/api/confirmar/${token}?via=${via}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setStatus("error");
        setMessage(json.error ?? "Ocurrió un error");
        return;
      }
      setStatus("done");
      setMessage(action === "confirm" ? "¡Pedido confirmado! Gracias." : "Pedido cancelado.");
    } catch {
      setStatus("error");
      setMessage("No se pudo conectar. Intenta de nuevo.");
    }
  }

  if (status === "done") {
    return <p style={{ fontWeight: "bold" }}>{message}</p>;
  }

  return (
    <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
      <button onClick={() => act("confirm")} disabled={status === "loading"}>
        Confirmar pedido
      </button>
      <button onClick={() => act("cancel")} disabled={status === "loading"}>
        Cancelar pedido
      </button>
      {status === "error" && <p style={{ color: "crimson" }}>{message}</p>}
    </div>
  );
}
