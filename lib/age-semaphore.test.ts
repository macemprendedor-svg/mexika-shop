import { describe, expect, it } from "vitest";
import { computeAgeSemaphore } from "./age-semaphore";

describe("computeAgeSemaphore", () => {
  const now = new Date(2026, 0, 1, 12, 0, 0);

  it("verde antes de 60 minutos", () => {
    const ref = new Date(now.getTime() - 30 * 60_000);
    expect(computeAgeSemaphore(ref, now)).toBe("green");
  });

  it("amarillo entre 60 y 240 minutos", () => {
    const ref = new Date(now.getTime() - 90 * 60_000);
    expect(computeAgeSemaphore(ref, now)).toBe("yellow");
  });

  it("rojo a partir de 240 minutos", () => {
    const ref = new Date(now.getTime() - 300 * 60_000);
    expect(computeAgeSemaphore(ref, now)).toBe("red");
  });

  it("verde en el límite exacto de 0 minutos", () => {
    expect(computeAgeSemaphore(now, now)).toBe("green");
  });
});
