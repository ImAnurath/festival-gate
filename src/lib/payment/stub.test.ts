import { describe, it, expect } from "vitest";
import { StubPaymentProvider } from "./stub";

const provider = new StubPaymentProvider("http://localhost:3000");

describe("StubPaymentProvider", () => {
  it("creates a checkout pointing at the local confirm route", async () => {
    const s = await provider.createCheckout({
      applicationId: "app1",
      amount: 1500,
      email: "ali@example.com",
      payToken: "TOKEN123",
    });
    expect(s.url).toBe("http://localhost:3000/pay/TOKEN123/confirm");
    expect(s.ref).toMatch(/^stub_/);
  });

  it("verifies a callback carrying a payToken", async () => {
    const r = await provider.verifyCallback({ payToken: "TOKEN123", ref: "stub_abc" });
    expect(r).toEqual({ ok: true, payToken: "TOKEN123", ref: "stub_abc" });
  });

  it("rejects a callback with no payToken", async () => {
    const r = await provider.verifyCallback({});
    expect(r.ok).toBe(false);
  });
});
