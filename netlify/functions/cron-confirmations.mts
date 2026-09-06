import type { Config } from "@netlify/functions";

// Dispara /api/cron/process-confirmations (correo2/SMS + cancelación por
// no confirmar). Cada 15 min: las ventanas de confirmación son por horas,
// no necesita más frecuencia que esa.
const handler = async () => {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const secret = process.env.CRON_SECRET;
  const res = await fetch(`${appUrl}/api/cron/process-confirmations`, {
    method: "POST",
    headers: secret ? { Authorization: `Bearer ${secret}` } : {},
  });
  console.log("cron-confirmations:", res.status, await res.text());
};

export default handler;

export const config: Config = {
  schedule: "*/15 * * * *",
};
