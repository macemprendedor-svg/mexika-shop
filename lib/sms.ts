/**
 * Envío de SMS de confirmación vía smsmasivos.com.mx.
 * Docs: https://app.smsmasivos.com.mx/api-docs/api-reference/sms-masivos
 */
export type SendSmsInput = {
  to: string;
  body: string;
};

export class SmsError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "SmsError";
  }
}

type SmsMasivosResponse = {
  success: boolean;
  message: string;
  code?: string;
};

/**
 * Normaliza un teléfono a los 10 dígitos locales que espera smsmasivos
 * (el country_code va aparte). Acepta formatos con o sin +52 / 52 delante.
 */
export function normalizeMexicanPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return digits;
  if (digits.length === 12 && digits.startsWith("52")) return digits.slice(2);
  if (digits.length === 13 && digits.startsWith("521")) return digits.slice(3); // formato viejo +521 (móvil)
  throw new SmsError(`Teléfono no reconocible como número mexicano de 10 dígitos: ${phone}`);
}

export async function sendSms(input: SendSmsInput): Promise<void> {
  const apiKey = process.env.SMSMASIVOS_API_KEY;
  if (!apiKey) {
    throw new SmsError("Falta SMSMASIVOS_API_KEY en las variables de entorno");
  }

  const numbers = normalizeMexicanPhone(input.to);
  const sandbox = process.env.SMSMASIVOS_SANDBOX === "1" ? 1 : undefined;

  const response = await fetch("https://api.smsmasivos.com.mx/sms/send", {
    method: "POST",
    headers: {
      apikey: apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      numbers,
      message: input.body,
      country_code: "52",
      shorten_url: 1, // nuestros SMS siempre incluyen el link de confirmación
      ...(sandbox ? { sandbox } : {}),
    }),
  });

  const json = (await response.json()) as SmsMasivosResponse;

  if (!response.ok || !json.success) {
    throw new SmsError(`smsmasivos respondió: ${json.message ?? response.status}`, json.code);
  }
}
