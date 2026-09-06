import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Evita crear múltiples instancias de PrismaClient con el hot-reload de Next.js en dev.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("Falta DATABASE_URL en las variables de entorno");
  }
  // rejectUnauthorized: false porque el pooler de Supabase (Supavisor) presenta
  // una cadena de certificados que Node no valida por default ("self-signed
  // certificate in certificate chain"), un problema conocido y documentado
  // de Supabase + node-postgres. La conexión sigue cifrada, solo no se valida
  // la cadena completa del certificado.
  const adapter = new PrismaPg({ connectionString, ssl: { rejectUnauthorized: false } });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
