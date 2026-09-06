import type { Config } from "@netlify/functions";

// Dispara /api/cron/reconciliation (compara nuestra base contra el estado
// real en Shopify). Una vez por hora es suficiente para este volumen.
export default async () => {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const secret = process.env.CRON_SECRET;
  const res = await fetch(`${appUrl}/api/cron/reconciliation`, {
    method: "POST",
    headers: secret ? { Authorization: `Bearer ${secret}` } : {},
  });
  console.log("cron-reconciliation:", res.status, await res.text());
};

export const config: Config = {
  schedule: "@hourly",
};
