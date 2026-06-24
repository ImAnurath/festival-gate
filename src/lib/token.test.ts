import { describe, it, expect } from "vitest";
import { generatePayToken, expiryFromNow, generateVerifyToken, generateTicketCode, havaleReference } from "./token";

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

describe("generateVerifyToken", () => {
  it("returns a url-safe token and is unique per call", () => {
    const a = generateVerifyToken();
    const b = generateVerifyToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(a.length).toBeGreaterThanOrEqual(20);
    expect(a).not.toBe(b);
  });
});

describe("havaleReference", () => {
  it("returns 6 uppercase alphanumeric chars (no base64url symbols)", () => {
    expect(havaleReference("_NKM5Qabc123")).toBe("NKM5QA");
    expect(havaleReference("ab-cd_efGHIJ")).toBe("ABCDEF");
    expect(havaleReference("xy")).toBe("XY"); // short input: no padding, just what's there
  });

  it("is symbol-free for any generated pay token", () => {
    for (let i = 0; i < 50; i++) {
      expect(havaleReference(generatePayToken())).toMatch(/^[A-Z0-9]{6}$/);
    }
  });
});

describe("generateTicketCode", () => {
  it("returns KF- followed by 5 unambiguous chars", () => {
    for (let i = 0; i < 50; i++) {
      expect(generateTicketCode()).toMatch(/^KF-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{5}$/);
    }
  });
});
