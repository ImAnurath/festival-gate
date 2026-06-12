import { describe, it, expect, vi, beforeEach } from "vitest";

const { createIyzipay, initializeCheckout, retrieveCheckout } = vi.hoisted(() => ({
  createIyzipay: vi.fn(() => ({})),
  initializeCheckout: vi.fn(),
  retrieveCheckout: vi.fn(),
}));

vi.mock("./iyzipay-client", () => ({ createIyzipay, initializeCheckout, retrieveCheckout }));

import { IyzicoPaymentProvider } from "./iyzico";

const cfg = {
  apiKey: "key",
  secretKey: "secret",
  baseUrl: "https://sandbox-api.iyzipay.com",
  appUrl: "https://festival.example",
  eventName: "KİNDZİ FEST",
};

beforeEach(() => {
  createIyzipay.mockClear();
  initializeCheckout.mockReset();
  retrieveCheckout.mockReset();
});

describe("IyzicoPaymentProvider", () => {
  it("throws when API keys are missing", () => {
    expect(() => new IyzicoPaymentProvider({ ...cfg, apiKey: "" })).toThrow(/iyzico/i);
  });

  it("createCheckout returns paymentPageUrl + token and maps payToken to ids", async () => {
    initializeCheckout.mockResolvedValue({
      status: "success",
      paymentPageUrl: "https://iyzico/pay/abc",
      token: "tok_1",
    });
    const provider = new IyzicoPaymentProvider(cfg);

    const session = await provider.createCheckout({
      applicationId: "a1",
      amount: 1500,
      email: "ali@example.com",
      name: "Ali Veli",
      payToken: "PT1",
    });

    expect(session).toEqual({ url: "https://iyzico/pay/abc", ref: "tok_1" });
    const sentRequest = initializeCheckout.mock.calls[0][1] as Record<string, unknown>;
    expect(sentRequest.conversationId).toBe("PT1");
    expect(sentRequest.basketId).toBe("PT1");
    expect(sentRequest.price).toBe("1500");
    expect(sentRequest.paidPrice).toBe("1500");
    expect(sentRequest.callbackUrl).toBe("https://festival.example/api/payment/callback");
  });

  it("createCheckout throws when iyzico returns failure", async () => {
    initializeCheckout.mockResolvedValue({ status: "failure", errorMessage: "kart reddedildi" });
    const provider = new IyzicoPaymentProvider(cfg);
    await expect(
      provider.createCheckout({ applicationId: "a1", amount: 1500, email: "e@x.com", name: "Ali", payToken: "PT1" })
    ).rejects.toThrow("kart reddedildi");
  });

  it("verifyCallback returns ok + payToken + paidAmount on SUCCESS", async () => {
    retrieveCheckout.mockResolvedValue({
      status: "success",
      paymentStatus: "SUCCESS",
      basketId: "PT1",
      paymentId: "pay_9",
      paidPrice: "1500",
    });
    const provider = new IyzicoPaymentProvider(cfg);
    const result = await provider.verifyCallback({ token: "tok_1" });
    expect(result).toEqual({ ok: true, payToken: "PT1", ref: "pay_9", paidAmount: 1500 });
  });

  it("verifyCallback is not ok when paymentStatus is not SUCCESS", async () => {
    retrieveCheckout.mockResolvedValue({ status: "success", paymentStatus: "FAILURE", basketId: "PT1" });
    const provider = new IyzicoPaymentProvider(cfg);
    const result = await provider.verifyCallback({ token: "tok_1" });
    expect(result.ok).toBe(false);
  });

  it("verifyCallback is not ok and skips retrieve when token is missing", async () => {
    const provider = new IyzicoPaymentProvider(cfg);
    const result = await provider.verifyCallback({});
    expect(result.ok).toBe(false);
    expect(retrieveCheckout).not.toHaveBeenCalled();
  });
});
