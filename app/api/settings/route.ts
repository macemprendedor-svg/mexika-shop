import { getSetting, setSetting, SETTING_KEYS } from "@/lib/settings";

/**
 * Configuración editable del panel. Por ahora solo el correo de soporte de
 * Dropi, pero pensado para crecer sin necesitar más migraciones.
 * GET  /api/settings          -> { dropiSupportEmail }
 * POST /api/settings { dropiSupportEmail }
 */
export async function GET() {
  const dropiSupportEmail = await getSetting(
    SETTING_KEYS.DROPI_SUPPORT_EMAIL,
    process.env.DROPI_SOPORTE_EMAIL,
  );
  return Response.json({ ok: true, dropiSupportEmail });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const dropiSupportEmail = body?.dropiSupportEmail as string | undefined;

  if (!dropiSupportEmail) {
    return Response.json({ ok: false, error: "Falta 'dropiSupportEmail'" }, { status: 400 });
  }

  await setSetting(SETTING_KEYS.DROPI_SUPPORT_EMAIL, dropiSupportEmail);
  return Response.json({ ok: true });
}
