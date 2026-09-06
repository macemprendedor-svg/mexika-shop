import { processPendingConfirmations } from "@/lib/confirmation-engine";

/**
 * Disparador periódico (cron) del motor de confirmación: manda correo2/SMS
 * a los pedidos que cumplieron su ventana, y cancela los que nunca
 * confirmaron tras el SMS. Protegido con CRON_SECRET porque cambia estado
 * real (mensajes salientes, cancelaciones).
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (secret && authHeader !== `Bearer ${secret}`) {
    return Response.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }

  const result = await processPendingConfirmations();
  return Response.json({ ok: true, ...result });
}
