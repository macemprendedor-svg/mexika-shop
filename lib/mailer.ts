/**
 * Envío de correo transaccional via la API HTTP de Resend (sin SDK, para no
 * sumar una dependencia solo por esto). Requiere RESEND_API_KEY y
 * RESEND_FROM_EMAIL — mientras no estén configuradas, sendEmail lanza un
 * error explícito en vez de fallar en silencio.
 */
export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
};

export class MailerError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = "MailerError";
  }
}

export async function sendEmail(input: SendEmailInput): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;

  if (!apiKey || !from) {
    throw new MailerError(
      "Falta RESEND_API_KEY y/o RESEND_FROM_EMAIL en las variables de entorno",
    );
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: input.to,
      subject: input.subject,
      html: input.html,
    }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => undefined);
    throw new MailerError(`Resend respondió ${response.status}`, response.status, body);
  }
}
