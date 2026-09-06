import { sendSms, SmsError } from "@/lib/sms";

/**
 * SOLO DESARROLLO: manda un SMS de prueba para validar SMSMASIVOS_API_KEY.
 * POST /api/dev/test-sms { "to": "+525512345678" }
 */
export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return Response.json({ ok: false, error: "No disponible en producción" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const to = body?.to as string | undefined;
  if (!to) {
    return Response.json({ ok: false, error: "Falta 'to'" }, { status: 400 });
  }

  try {
    await sendSms({ to, body: "Prueba del motor de confirmacion COD. Link: https://example.com/x" });
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof SmsError) {
      return Response.json({ ok: false, error: error.message, code: error.code }, { status: 500 });
    }
    throw error;
  }
}
