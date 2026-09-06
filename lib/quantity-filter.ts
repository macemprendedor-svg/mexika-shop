/**
 * Filtro antifraude por cantidad de artículos (sección 3 del spec).
 * Se aplica justo después de que el cliente confirma, antes de tocar Dropi.
 * Se basa en el total de unidades del pedido (sin importar si son del mismo
 * producto o de productos distintos).
 */
export type QuantityFilterResult = "AUTO_APPROVE" | "NEEDS_REVIEW" | "BLOCKED";

export function applyQuantityFilter(totalUnits: number): QuantityFilterResult {
  if (totalUnits <= 1) return "AUTO_APPROVE";
  if (totalUnits <= 3) return "NEEDS_REVIEW";
  return "BLOCKED";
}
