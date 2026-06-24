import { describe, it, expect } from "vitest";
import { loadConfig, config } from "./config";

const base = {
  SESSION_PASSWORD: "x".repeat(32),
  EVENT_NAME: "KİNDZİ FEST",
  TICKET_PRICE: "500",
  MAX_TICKETS_PER_BUYER: "6",
  PAY_TOKEN_TTL_HOURS: "48",
  PAYMENT_PROVIDER: "stub",
  NOTIFIER: "console",
  NEXT_PUBLIC_APP_URL: "https://example.com",
  EVENT_END: "2026-09-01T21:00:00.000Z",
  HAVALE_IBAN: "TR000000000000000000000000",
  HAVALE_ACCOUNT_NAME: "Test Hesap Sahibi",
  HAVALE_BANK_NAME: "Test Bankası",
};

describe("loadConfig EVENT_END", () => {
  it("parses EVENT_END into a Date", () => {
    const c = loadConfig(base);
    expect(c.eventEnd).toBeInstanceOf(Date);
    expect(c.eventEnd.toISOString()).toBe("2026-09-01T21:00:00.000Z");
  });

  it("throws when EVENT_END is missing", () => {
    const { EVENT_END, ...without } = base;
    expect(() => loadConfig(without)).toThrow();
  });
});

describe("loadConfig", () => {
  const base = {
    SESSION_PASSWORD: "test-password-test-password-test-1234",
    EVENT_NAME: "Test Fest",
    TICKET_PRICE: "500",
    MAX_TICKETS_PER_BUYER: "6",
    PAY_TOKEN_TTL_HOURS: "72",
    PAYMENT_PROVIDER: "stub",
    NOTIFIER: "console",
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    EVENT_END: "2026-09-01T21:00:00.000Z",
    HAVALE_IBAN: "TR000000000000000000000000",
    HAVALE_ACCOUNT_NAME: "Test Hesap Sahibi",
    HAVALE_BANK_NAME: "Test Bankası",
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

  it("rejects a SESSION_PASSWORD shorter than 32 characters", () => {
    expect(() => loadConfig({ ...base, SESSION_PASSWORD: "too-short" })).toThrow();
  });

  it("rejects a missing SESSION_PASSWORD", () => {
    const { SESSION_PASSWORD: _omit, ...withoutPassword } = base;
    expect(() => loadConfig(withoutPassword)).toThrow();
  });
});

describe("config havale fields", () => {
  it("exposes the Havale bank-transfer details from env", () => {
    expect(config.havaleIban).toBe("TR000000000000000000000000");
    expect(config.havaleAccountName).toBe("Test Hesap Sahibi");
    expect(config.havaleBankName).toBe("Test Bankası");
  });
});
