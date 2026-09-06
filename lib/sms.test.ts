import { describe, expect, it } from "vitest";
import { normalizeMexicanPhone, SmsError } from "./sms";

describe("normalizeMexicanPhone", () => {
  it("deja pasar un número de 10 dígitos tal cual", () => {
    expect(normalizeMexicanPhone("5512345678")).toBe("5512345678");
  });

  it("quita el 52 delante en formato de 12 dígitos", () => {
    expect(normalizeMexicanPhone("525512345678")).toBe("5512345678");
  });

  it("quita el +52 delante", () => {
    expect(normalizeMexicanPhone("+525512345678")).toBe("5512345678");
  });

  it("quita el 521 delante (formato viejo de móvil)", () => {
    expect(normalizeMexicanPhone("+5215512345678")).toBe("5512345678");
  });

  it("ignora espacios y guiones", () => {
    expect(normalizeMexicanPhone("+52 55 1234 5678")).toBe("5512345678");
  });

  it("lanza SmsError si no reconoce el formato", () => {
    expect(() => normalizeMexicanPhone("123")).toThrow(SmsError);
  });
});
