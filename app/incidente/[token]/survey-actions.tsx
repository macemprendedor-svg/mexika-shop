"use client";

import { useState } from "react";

type Answer = "NOBODY_CAME" | "DELIVERED_BUT_REFUSED" | "OTHER";

export function SurveyActions({ token }: { token: string }) {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [showOther, setShowOther] = useState(false);
  const [otherText, setOtherText] = useState("");

  async function respond(answer: Answer, comment?: string) {
    setStatus("loading");
    setMessage(null);
    try {
      const res = await fetch(`/api/incidentes/${token}/responder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer, comment: comment ?? null }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setStatus("error");
        setMessage(json.error ?? "Ocurrió un error");
        return;
      }
      setStatus("done");
    } catch {
      setStatus("error");
      setMessage("No se pudo conectar. Intenta de nuevo.");
    }
  }

  if (status === "done") {
    return <p style={{ fontWeight: "bold" }}>Gracias, ya registramos tu respuesta.</p>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 24 }}>
      <button onClick={() => respond("NOBODY_CAME")} disabled={status === "loading"}>
        Nunca llegaron, no tocaron ni llamaron
      </button>
      <button onClick={() => respond("DELIVERED_BUT_REFUSED")} disabled={status === "loading"}>
        Sí llegaron, pero decidí ya no recibirlo
      </button>
      <button onClick={() => setShowOther(true)} disabled={status === "loading"}>
        Otro motivo
      </button>
      {showOther && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <textarea
            value={otherText}
            onChange={(e) => setOtherText(e.target.value)}
            placeholder="Cuéntanos brevemente qué pasó"
          />
          <button onClick={() => respond("OTHER", otherText)} disabled={status === "loading"}>
            Enviar
          </button>
        </div>
      )}
      {status === "error" && <p style={{ color: "crimson" }}>{message}</p>}
    </div>
  );
}
