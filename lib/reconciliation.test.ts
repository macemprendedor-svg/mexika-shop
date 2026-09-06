import { describe, expect, it } from "vitest";
import { detectDrift } from "./reconciliation";

describe("detectDrift", () => {
  it("no detecta nada cuando todo coincide (PENDING_CONFIRMATION + PENDING)", () => {
    expect(detectDrift("PENDING_CONFIRMATION", "PENDING", null)).toBeNull();
  });

  it("no detecta nada cuando SENT_TO_DROPI coincide con PAID", () => {
    expect(detectDrift("SENT_TO_DROPI", "PAID", null)).toBeNull();
  });

  it("detecta drift si SENT_TO_DROPI pero Shopify no muestra PAID", () => {
    expect(detectDrift("SENT_TO_DROPI", "PENDING", null)).toMatch(/enviado a Dropi/);
  });

  it("detecta drift si Shopify ya está pagado pero seguimos en CONFIRMED", () => {
    expect(detectDrift("CONFIRMED", "PAID", null)).toMatch(/ya lo muestra como pagado/);
  });

  it("detecta drift si Shopify cancelado pero nosotros no lo reflejamos", () => {
    expect(detectDrift("CONFIRMED", "PENDING", "2026-01-01T00:00:00Z")).toMatch(/cancelado en Shopify/);
  });

  it("no marca drift por cancelación cuando ya está PAUSED_ZONE_BLOCKED", () => {
    expect(detectDrift("PAUSED_ZONE_BLOCKED", "PENDING", "2026-01-01T00:00:00Z")).toBeNull();
  });

  it("no detecta nada para QUANTITY_REVIEW + PENDING", () => {
    expect(detectDrift("QUANTITY_REVIEW", "PENDING", null)).toBeNull();
  });
});
