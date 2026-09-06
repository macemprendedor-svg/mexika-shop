import { defineConfig } from "vitest/config";
import path from "node:path";
import { config } from "dotenv";

config({ path: path.resolve(import.meta.dirname, ".env.local") });

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "."),
    },
  },
});
