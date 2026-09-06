import { prisma } from "@/lib/db";

/**
 * Configuración editable desde el panel (tabla AppSetting), con fallback a
 * una variable de entorno para el valor inicial. Pensado para valores que
 * pueden cambiar en operación sin justificar un redeploy (ej. el correo de
 * soporte de Dropi).
 */
export async function getSetting(key: string, envFallback?: string): Promise<string | null> {
  const row = await prisma.appSetting.findUnique({ where: { key } });
  if (row) return row.value;
  return envFallback ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await prisma.appSetting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
}

export const SETTING_KEYS = {
  DROPI_SUPPORT_EMAIL: "dropi_support_email",
} as const;
