export type ExceptionCategory =
  | "QUANTITY_REVIEW"
  | "ZONE_BLOCKED"
  | "STUCK_BEFORE_DROPI"
  | "UNCONFIRMED_HISTORY"
  | "CUSTOMER_RISK_REVIEW";

export const EXCEPTION_META: Record<
  ExceptionCategory,
  { label: string; badgeColor: "red" | "orange" | "amber" | "violet" | "blue"; actionLabel: string }
> = {
  STUCK_BEFORE_DROPI: { label: "Crítica", badgeColor: "red", actionLabel: "Reintentar envío" },
  ZONE_BLOCKED: { label: "Alta", badgeColor: "orange", actionLabel: "Forzar envío" },
  CUSTOMER_RISK_REVIEW: { label: "Alta", badgeColor: "violet", actionLabel: "Revisar riesgo" },
  QUANTITY_REVIEW: { label: "Media", badgeColor: "amber", actionLabel: "Aprobar o rechazar" },
  UNCONFIRMED_HISTORY: { label: "Media", badgeColor: "blue", actionLabel: "Aprobar o eliminar" },
};

export function formatAge(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}min`;
}
