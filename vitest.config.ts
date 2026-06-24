import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

// DB-backed tests run against a SEPARATE Postgres database so a test run never
// wipes your local dev/hand-testing data. The test DB URL is derived from the
// app's own .env DATABASE_URL by appending "_test" to the database name, so it
// reuses your real host/user/password automatically — no extra env file to keep
// in sync. Precedence: explicit DATABASE_URL_TEST > derived-from-.env > default.
try {
  process.loadEnvFile(".env");
} catch {
  // no .env (e.g. CI sets env vars directly) — fall back to the default below
}

function deriveTestDatabaseUrl(): string {
  if (process.env.DATABASE_URL_TEST) return process.env.DATABASE_URL_TEST;
  const base = process.env.DATABASE_URL;
  if (base) {
    try {
      const url = new URL(base);
      if (!url.pathname.endsWith("_test")) url.pathname += "_test";
      return url.toString();
    } catch {
      // malformed DATABASE_URL — fall through to the localhost default
    }
  }
  return "postgresql://postgres:postgres@localhost:5432/festival_gate_test";
}

const TEST_DATABASE_URL = deriveTestDatabaseUrl();

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    globals: true,
    // DB-backed tests do real Postgres work (ticket issuance, PDF/QR); the first
    // one on a cold connection can exceed the 5s default. 15s absorbs that.
    testTimeout: 15000,
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
