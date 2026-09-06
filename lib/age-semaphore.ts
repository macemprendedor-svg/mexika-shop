/**
 * Semáforo de antigüedad genérico (sección 5 del spec): verde/amarillo/rojo
 * según cuánto tiempo lleva un pedido en su estado actual sin avanzar.
 */
export type AgeSemaphore = "green" | "yellow" | "red";

const YELLOW_AFTER_MINUTES = 60;
const RED_AFTER_MINUTES = 240;

export function computeAgeSemaphore(referenceDate: Date, now: Date = new Date()): AgeSemaphore {
  const minutes = (now.getTime() - referenceDate.getTime()) / 60_000;
  if (minutes >= RED_AFTER_MINUTES) return "red";
  if (minutes >= YELLOW_AFTER_MINUTES) return "yellow";
  return "green";
}
