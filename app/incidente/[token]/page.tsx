import { getIncidentByToken } from "@/lib/incidents";
import { SurveyActions } from "./survey-actions";

type PageProps = { params: Promise<{ token: string }> };

export default async function IncidentSurveyPage({ params }: PageProps) {
  const { token } = await params;
  const incident = await getIncidentByToken(token);

  if (!incident) {
    return <StatusMessage title="Enlace inválido" message="Este enlace no existe." />;
  }

  if (incident.surveyRespondedAt) {
    return (
      <StatusMessage
        title="Ya registramos tu respuesta"
        message="Gracias, ya no necesitamos nada más de tu parte por este incidente."
      />
    );
  }

  return (
    <main style={{ maxWidth: 480, margin: "40px auto", padding: 16, fontFamily: "system-ui" }}>
      <h1>¿Qué pasó con tu entrega?</h1>
      <p>
        {incident.carrierName ?? "La transportadora"} nos reporta que hoy visitó tu domicilio para
        entregar tu pedido y no fue posible completarlo.
      </p>
      <SurveyActions token={token} />
    </main>
  );
}

function StatusMessage({ title, message }: { title: string; message: string }) {
  return (
    <main style={{ maxWidth: 480, margin: "40px auto", padding: 16, fontFamily: "system-ui" }}>
      <h1>{title}</h1>
      <p>{message}</p>
    </main>
  );
}
