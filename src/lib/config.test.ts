import { describe, it, expect } from "vitest";
import { loadConfig } from "./config";

describe("loadConfig", () => {
  const base = {
    EVENT_NAME: "Test Fest",
    TICKET_PRICE: "500",
    MAX_TICKETS_PER_BUYER: "6",
    PAY_TOKEN_TTL_HOURS: "72",
    PAYMENT_PROVIDER: "stub",
    NOTIFIER: "console",
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  };

  it("parses numeric and enum fields", () => {
    const c = loadConfig(base);
    expect(c.ticketPrice).toBe(500);
    expect(c.maxTicketsPerBuyer).toBe(6);
    expect(c.payTokenTtlHours).toBe(72);
    expect(c.paymentProvider).toBe("stub");
  });

  it("rejects an invalid provider", () => {
    expect(() => loadConfig({ ...base, PAYMENT_PROVIDER: "bitcoin" })).toThrow();
  });

  it("rejects a non-numeric ticket price", () => {
    expect(() => loadConfig({ ...base, TICKET_PRICE: "free" })).toThrow();
  });
});
