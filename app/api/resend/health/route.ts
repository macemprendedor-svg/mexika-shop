/**
 * Lista los dominios verificados en la cuenta de Resend, para saber qué
 * RESEND_FROM_EMAIL se puede usar. Solo lectura.
 * GET /api/resend/health
 */
export async function GET() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return Response.json({ ok: false, error: "Falta RESEND_API_KEY" }, { status: 500 });
  }

  const response = await fetch("https://api.resend.com/domains", {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  const json = await response.json();

  if (!response.ok) {
    return Response.json({ ok: false, error: json }, { status: response.status });
  }

  return Response.json({ ok: true, domains: json });
}
