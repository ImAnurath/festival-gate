import { describe, it, expect } from "vitest";
import { approve, reject, assertPayable, TransitionError } from "./state-machine";

const future = new Date(Date.now() + 60 * 60 * 1000);
const past = new Date(Date.now() - 60 * 1000);
const now = new Date();

describe("approve", () => {
  it("moves PENDING to APPROVED", () => {
    expect(approve("PENDING")).toBe("APPROVED");
  });
  it("rejects approving a non-PENDING application", () => {
    expect(() => approve("PAID")).toThrow(TransitionError);
  });
});

describe("reject", () => {
  it("moves PENDING to REJECTED", () => {
    expect(reject("PENDING")).toBe("REJECTED");
  });
  it("moves APPROVED to REJECTED", () => {
    expect(reject("APPROVED")).toBe("REJECTED");
  });
  it("refuses to reject a PAID application", () => {
    expect(() => reject("PAID")).toThrow(TransitionError);
  });
});

describe("assertPayable", () => {
  it("allows an APPROVED app with a live token", () => {
    expect(() =>
      assertPayable({ status: "APPROVED", payTokenExpiresAt: future, paidAt: null }, now)
    ).not.toThrow();
  });
  it("blocks payment when still PENDING", () => {
    expect(() =>
      assertPayable({ status: "PENDING", payTokenExpiresAt: future, paidAt: null }, now)
    ).toThrow(TransitionError);
  });
  it("blocks payment when the token expired", () => {
    expect(() =>
      assertPayable({ status: "APPROVED", payTokenExpiresAt: past, paidAt: null }, now)
    ).toThrow(TransitionError);
  });
  it("blocks a second payment when already PAID", () => {
    expect(() =>
      assertPayable({ status: "PAID", payTokenExpiresAt: future, paidAt: now }, now)
    ).toThrow(TransitionError);
  });
});
