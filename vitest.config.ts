import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

// DB-backed tests use Postgres. Override with DATABASE_URL_TEST if your local
// Postgres differs; otherwise they skip gracefully when no DB is reachable.
const TEST_DATABASE_URL =
  process.env.DATABASE_URL_TEST ??
  "postgresql://postgres:postgres@localhost:5432/festival_gate_test";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    globals: true,
    // DB-backed test files (applications.test.ts, tickets.test.ts) share one
    // Postgres database via resetDb(). Running files in parallel causes one
    // file's resetDb() to truncate rows the other file just inserted, producing
    // FK violations and record-not-found errors. Serial file execution fixes this.
    fileParallelism: false,
    setupFiles: [],
    // config.ts validates these at import time; provide test defaults so any
    // module that imports config can be unit-tested without a real .env.
    env: {
      DATABASE_URL: TEST_DATABASE_URL,
      SESSION_PASSWORD: "test-password-test-password-test-1234",
      EVENT_NAME: "Test Fest",
      TICKET_PRICE: "500",
      MAX_TICKETS_PER_BUYER: "6",
      PAY_TOKEN_TTL_HOURS: "72",
      PAYMENT_PROVIDER: "stub",
      NOTIFIER: "console",
      WHATSAPP_PROVIDER: "console",
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      EVENT_END: "2026-09-01T21:00:00.000Z",
    },
  },
});
