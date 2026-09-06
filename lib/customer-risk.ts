import { prisma } from "@/lib/db";
import type { DeliveryIncident } from "@prisma/client";

/**
 * Historial de rechazados / "números quemados" (sección 4.2 del spec —
 * hueco de Fase 1 que se cierra aquí como base de la puntuación de riesgo
 * de Fase 4). Se llena con rechazos REALES en la entrega (el cliente sí
 * recibió la visita pero decidió no aceptar el paquete), NO con rechazos
 * falsos de la transportadora (esos son culpa del carrier, no del
 * cliente, y no deben perjudicarlo). Es independiente del historial de no
 * confirmados (4.1): no bloquea nada hasta que el cliente vuelve a comprar.
 */
export async function getCustomerRejectionHistory(
  email: string | null,
  phone: string | null,
  excludeOrderId?: string,
): Promise<DeliveryIncident[]> {
  const contactFilters = [
    email ? { customerEmail: email } : null,
    phone ? { customerPhone: phone } : null,
  ].filter((f): f is NonNullable<typeof f> => f !== null);

  if (contactFilters.length === 0) return [];

  return prisma.deliveryIncident.findMany({
    where: {
      verdict: "REJECTED_BY_CUSTOMER",
      ...(excludeOrderId ? { orderId: { not: excludeOrderId } } : {}),
      OR: contactFilters,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function hasRejectionHistory(
  email: string | null,
  phone: string | null,
  excludeOrderId?: string,
): Promise<boolean> {
  const history = await getCustomerRejectionHistory(email, phone, excludeOrderId);
  return history.length > 0;
}
