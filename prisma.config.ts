import { defineConfig } from "prisma/config";

// Prisma 7 does not auto-load .env when a prisma.config.ts is present, so load
// it here for CLI commands (migrate/generate). In production the platform sets
// env vars directly and there is no .env file, hence the try/catch.
try {
  process.loadEnvFile();
} catch {
  // no .env file (e.g. production); rely on real environment variables
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL ?? "",
  },
});
