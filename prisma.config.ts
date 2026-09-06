import { config } from "dotenv";
import { defineConfig, env } from "prisma/config";

// prisma.config.ts corre fuera del runtime de Next.js (CLI de migraciones),
// así que carga .env.local a mano en vez de depender del autoload de Next.
config({ path: ".env.local" });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
