import { describe, expect, it } from "vitest";
import { applyQuantityFilter } from "./quantity-filter";

describe("applyQuantityFilter", () => {
  it("aprueba automático con 1 unidad", () => {
    expect(applyQuantityFilter(1)).toBe("AUTO_APPROVE");
  });

  it("aprueba automático con 0 unidades (caso borde, no debería ocurrir)", () => {
    expect(applyQuantityFilter(0)).toBe("AUTO_APPROVE");
  });

  it("requiere revisión con 2 unidades", () => {
    expect(applyQuantityFilter(2)).toBe("NEEDS_REVIEW");
  });

  it("requiere revisión con 3 unidades", () => {
    expect(applyQuantityFilter(3)).toBe("NEEDS_REVIEW");
  });

  it("bloquea con 4 unidades", () => {
    expect(applyQuantityFilter(4)).toBe("BLOCKED");
  });

  it("bloquea con cantidades grandes", () => {
    expect(applyQuantityFilter(50)).toBe("BLOCKED");
  });
});
