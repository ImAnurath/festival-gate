import { describe, it, expect } from "vitest";
import {
  SHOWCASE_PAY_TOKEN,
  isShowcaseToken,
  SHOWCASE_DEMO,
  SHOWCASE_DEMO_TICKETS,
} from "./showcase";

describe("isShowcaseToken", () => {
  it("is true for the showcase token", () => {
    expect(isShowcaseToken(SHOWCASE_PAY_TOKEN)).toBe(true);
  });

  it("is false for a real token", () => {
    expect(isShowcaseToken("some-random-real-token")).toBe(false);
  });

  it("is false for null/undefined", () => {
    expect(isShowcaseToken(null)).toBe(false);
    expect(isShowcaseToken(undefined)).toBe(false);
  });
});

describe("showcase demo data", () => {
  it("has one ticket per declared quantity", () => {
    expect(SHOWCASE_DEMO_TICKETS).toHaveLength(SHOWCASE_DEMO.ticketQuantity);
  });

  it("lists the buyer first, then guests", () => {
    expect(SHOWCASE_DEMO_TICKETS[0].isBuyer).toBe(true);
    expect(SHOWCASE_DEMO_TICKETS[0].holderName).toBe(SHOWCASE_DEMO.name);
    for (const t of SHOWCASE_DEMO_TICKETS.slice(1)) {
      expect(t.isBuyer).toBe(false);
    }
  });

  it("gives every ticket a unique code and verify token", () => {
    const codes = new Set(SHOWCASE_DEMO_TICKETS.map((t) => t.code));
    const tokens = new Set(SHOWCASE_DEMO_TICKETS.map((t) => t.verifyToken));
    expect(codes.size).toBe(SHOWCASE_DEMO_TICKETS.length);
    expect(tokens.size).toBe(SHOWCASE_DEMO_TICKETS.length);
  });

  it("carries a fixed payment reference for the receipt", () => {
    expect(SHOWCASE_DEMO.paymentRef).toMatch(/\S/);
  });
});
