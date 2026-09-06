import type { Config } from "@netlify/functions";

// Dispara /api/cron/process-incident-surveys (escalar a SMS a las 3h,
// cancelar a las 24h sin respuesta). Cada 30 min es suficiente.
export default async () => {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const secret = process.env.CRON_SECRET;
  const res = await fetch(`${appUrl}/api/cron/process-incident-surveys`, {
    method: "POST",
    headers: secret ? { Authorization: `Bearer ${secret}` } : {},
  });
  console.log("cron-incident-surveys:", res.status, await res.text());
};

export const config: Config = {
  schedule: "*/30 * * * *",
};
