import { describe, expect, it } from "vitest";
import { computeConfirmationSchedule } from "./confirmation-schedule";

function at(hour: number, minute = 0): Date {
  return new Date(2026, 8, 5, hour, minute, 0, 0); // 5-sep-2026, mes 0-indexado
}

function hm(date: Date): string {
  return `${date.getHours()}:${String(date.getMinutes()).padStart(2, "0")}`;
}

describe("computeConfirmationSchedule", () => {
  it("pedido a mediodía: ventana completa de 4h para SMS", () => {
    const s = computeConfirmationSchedule(at(12, 0));
    expect(hm(s.email1At)).toBe("12:00");
    expect(hm(s.email2At)).toBe("13:00");
    expect(hm(s.smsAt)).toBe("16:00");
    expect(s.wasNightOrder).toBe(false);
    expect(s.deferredToNextDay).toBe(false);
  });

  it("pedido a las 4:59pm: todavía ventana completa (SMS cae a las 8:59pm)", () => {
    const s = computeConfirmationSchedule(at(16, 59));
    expect(hm(s.smsAt)).toBe("20:59");
    expect(s.deferredToNextDay).toBe(false);
  });

  it("pedido a las 5pm exacto: SMS cae justo a las 9pm", () => {
    const s = computeConfirmationSchedule(at(17, 0));
    expect(hm(s.smsAt)).toBe("21:00");
    expect(s.deferredToNextDay).toBe(false);
  });

  it("pedido a las 6pm: ventana se acorta a 3h, SMS a las 9pm", () => {
    const s = computeConfirmationSchedule(at(18, 0));
    expect(hm(s.email2At)).toBe("19:00");
    expect(hm(s.smsAt)).toBe("21:00");
  });

  it("pedido a las 7pm: ventana se acorta a 2h, SMS a las 9pm", () => {
    const s = computeConfirmationSchedule(at(19, 0));
    expect(hm(s.smsAt)).toBe("21:00");
  });

  it("pedido a las 8pm: ventana se acorta a 1h, SMS a las 9pm", () => {
    const s = computeConfirmationSchedule(at(20, 0));
    expect(hm(s.smsAt)).toBe("21:00");
  });

  it("pedido a las 9pm: se pospone correo2 y SMS al día siguiente", () => {
    const s = computeConfirmationSchedule(at(21, 0));
    expect(s.deferredToNextDay).toBe(true);
    expect(s.email2At.getDate()).toBe(6); // día siguiente
    expect(hm(s.email2At)).toBe("8:00");
    expect(hm(s.smsAt)).toBe("12:00");
  });

  it("pedido a las 10pm (noche): correo1 inmediato, resto pospuesto", () => {
    const s = computeConfirmationSchedule(at(22, 30));
    expect(s.wasNightOrder).toBe(true);
    expect(s.deferredToNextDay).toBe(true);
    expect(hm(s.email1At)).toBe("22:30");
    expect(s.email2At.getDate()).toBe(6);
    expect(hm(s.email2At)).toBe("8:00");
    expect(hm(s.smsAt)).toBe("12:00");
  });

  it("pedido a las 2am (noche): pospone al mismo día a las 8am", () => {
    const s = computeConfirmationSchedule(at(2, 0));
    expect(s.wasNightOrder).toBe(true);
    expect(s.email2At.getDate()).toBe(5); // mismo día calendario
    expect(hm(s.email2At)).toBe("8:00");
    expect(hm(s.smsAt)).toBe("12:00");
  });

  it("nunca programa email2 o sms dentro de 22:00-08:00", () => {
    for (let hour = 0; hour < 24; hour++) {
      const s = computeConfirmationSchedule(at(hour, 0));
      const inNight = (d: Date) => d.getHours() >= 22 || d.getHours() < 8;
      expect(inNight(s.email2At)).toBe(false);
      expect(inNight(s.smsAt)).toBe(false);
    }
  });
});
