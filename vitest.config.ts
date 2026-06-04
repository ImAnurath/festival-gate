import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    globals: true,
    setupFiles: [],
    // config.ts validates these at import time; provide test defaults so any
    // module that imports config can be unit-tested without a real .env.
    env: {
      DATABASE_URL: "file:./test.db",
      SESSION_PASSWORD: "test-password-test-password-test-1234",
      EVENT_NAME: "Test Fest",
      TICKET_PRICE: "500",
      MAX_TICKETS_PER_BUYER: "6",
      PAY_TOKEN_TTL_HOURS: "72",
      PAYMENT_PROVIDER: "stub",
      NOTIFIER: "console",
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    },
  },
});
