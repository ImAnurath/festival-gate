import { describe, it, expect } from "vitest";
import { normalizeTrPhone } from "./phone";

describe("normalizeTrPhone", () => {
  it("normalizes a 0-prefixed mobile to E.164", () => {
    expect(normalizeTrPhone("0532 123 45 67")).toBe("+905321234567");
  });

  it("accepts +90 with spaces and dashes", () => {
    expect(normalizeTrPhone("+90 532-123-45-67")).toBe("+905321234567");
  });

  it("accepts a bare 10-digit mobile starting with 5", () => {
    expect(normalizeTrPhone("5321234567")).toBe("+905321234567");
  });

  it("accepts a 90-prefixed number without plus", () => {
    expect(normalizeTrPhone("905321234567")).toBe("+905321234567");
  });

  it("rejects too-short input", () => {
    expect(normalizeTrPhone("12345")).toBeNull();
  });

  it("rejects non-mobile (not starting with 5)", () => {
    expect(normalizeTrPhone("0212 123 45 67")).toBeNull();
  });

  it("rejects garbage", () => {
    expect(normalizeTrPhone("not a phone")).toBeNull();
  });

  it("rejects empty string", () => {
    expect(normalizeTrPhone("")).toBeNull();
  });
});
