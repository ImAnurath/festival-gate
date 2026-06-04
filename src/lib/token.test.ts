import { describe, it, expect } from "vitest";
import { generatePayToken, expiryFromNow } from "./token";

describe("generatePayToken", () => {
  it("produces a long url-safe token", () => {
    const t = generatePayToken();
    expect(t).toMatch(/^[A-Za-z0-9_-]{32,}$/);
  });
  it("produces unique tokens", () => {
    expect(generatePayToken()).not.toBe(generatePayToken());
  });
});

describe("expiryFromNow", () => {
  it("adds the given hours", () => {
    const base = new Date("2026-06-04T00:00:00Z");
    expect(expiryFromNow(72, base).toISOString()).toBe("2026-06-07T00:00:00.000Z");
  });
});
