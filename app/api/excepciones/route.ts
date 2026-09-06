import { getExceptionsInbox } from "@/lib/exceptions";

/**
 * Bandeja única de excepciones (sección 5): GET /api/excepciones
 */
export async function GET() {
  const items = await getExceptionsInbox();
  return Response.json({ ok: true, items });
}
