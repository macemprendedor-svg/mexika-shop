/**
 * Calcula en qué momentos se debe mandar Correo 1, Correo 2 y SMS según la
 * hora del pedido (sección 2 del spec). Zona horaria asumida: America/Mexico_City
 * (el negocio opera en México) — ajustable via TIMEZONE si hace falta.
 *
 * Reglas del spec:
 * - Correo 1: inmediato, siempre, sin importar la hora.
 * - Correo 2: 1h después, si no ha confirmado.
 * - SMS: hasta 4h después, si sigue sin confirmar. La ventana se acorta si el
 *   pedido es tarde para que el SMS no caiga en horario nocturno (22:00-08:00).
 * - Horario nocturno (22:00-08:00): nunca se manda nada. Si el pedido se hizo
 *   de noche, correo 1 sale igual de inmediato, pero correo 2 y SMS se
 *   posponen hasta el día siguiente.
 *
 * Interpretación para huecos que el spec no cubre explícitamente (pedidos
 * entre 21:00 y 22:00, o cuando "+1h"/"+4h" caerían justo en la frontera
 * nocturna): se tratan igual que un pedido nocturno, es decir, correo 2 y
 * SMS se posponen al día siguiente. Esto es una decisión de diseño nuestra,
 * no un requisito explícito del documento — revisar si no es el
 * comportamiento deseado.
 */

const NIGHT_START_HOUR = 22; // 10pm
const NIGHT_END_HOUR = 8; // 8am
const SMS_MAX_WINDOW_HOURS = 4;
const EMAIL2_DELAY_HOURS = 1;
const LATEST_SAFE_HOUR = 21; // ningún mensaje debe programarse después de las 9pm

export type ConfirmationSchedule = {
  email1At: Date;
  email2At: Date;
  smsAt: Date;
  /** true si el pedido se creó dentro del horario nocturno (22:00-08:00) */
  wasNightOrder: boolean;
  /** true si correo2/SMS se pospusieron al día siguiente por cercanía a la noche */
  deferredToNextDay: boolean;
};

function isNightHour(hour: number): boolean {
  return hour >= NIGHT_START_HOUR || hour < NIGHT_END_HOUR;
}

function atHour(date: Date, hour: number, minute = 0): Date {
  const d = new Date(date);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function nextResumeTime(orderCreatedAt: Date): Date {
  // Próximas 8:00am: mismo día si el pedido fue antes de las 8am,
  // o al día siguiente si fue a partir de las 22:00.
  const sameDay8am = atHour(orderCreatedAt, NIGHT_END_HOUR);
  if (orderCreatedAt.getHours() < NIGHT_END_HOUR) {
    return sameDay8am;
  }
  const nextDay = new Date(orderCreatedAt);
  nextDay.setDate(nextDay.getDate() + 1);
  return atHour(nextDay, NIGHT_END_HOUR);
}

export function computeConfirmationSchedule(orderCreatedAt: Date): ConfirmationSchedule {
  const hour = orderCreatedAt.getHours();
  const wasNightOrder = isNightHour(hour);

  // Pedido nocturno, o tan tarde (>=21:00) que ni correo2 (+1h) ni el SMS
  // recortado caben antes del corte de las 9pm: todo se pospone al día
  // siguiente salvo el correo 1, que ya salió de inmediato.
  const tooLateForSameDay = hour >= LATEST_SAFE_HOUR && hour < NIGHT_START_HOUR;

  if (wasNightOrder || tooLateForSameDay) {
    const resume = nextResumeTime(orderCreatedAt);
    return {
      email1At: orderCreatedAt,
      email2At: resume,
      smsAt: addHours(resume, SMS_MAX_WINDOW_HOURS),
      wasNightOrder,
      deferredToNextDay: true,
    };
  }

  const email2At = addHours(orderCreatedAt, EMAIL2_DELAY_HOURS);

  const rawSmsAt = addHours(orderCreatedAt, SMS_MAX_WINDOW_HOURS);
  const latestSameDaySms = atHour(orderCreatedAt, LATEST_SAFE_HOUR);
  const smsAt = rawSmsAt > latestSameDaySms ? latestSameDaySms : rawSmsAt;

  return {
    email1At: orderCreatedAt,
    email2At,
    smsAt,
    wasNightOrder: false,
    deferredToNextDay: false,
  };
}
