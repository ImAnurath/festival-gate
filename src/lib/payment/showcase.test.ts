import { describe, it, expect } from "vitest";
import { SHOWCASE_PAY_TOKEN, isShowcaseToken } from "./showcase";

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
