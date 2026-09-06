import { sendEmail, MailerError } from "@/lib/mailer";

/**
 * SOLO DESARROLLO: manda un correo de prueba para validar RESEND_API_KEY y
 * RESEND_FROM_EMAIL sin depender de un pedido real.
 * POST /api/dev/test-email { "to": "correo@ejemplo.com" }
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
    await sendEmail({
      to,
      subject: "Prueba — Sistema de pedidos COD",
      html: "<p>Este es un correo de prueba del motor de confirmación (Fase 1).</p>",
    });
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof MailerError) {
      return Response.json({ ok: false, error: error.message, details: error.body }, { status: error.status ?? 500 });
    }
    throw error;
  }
}
