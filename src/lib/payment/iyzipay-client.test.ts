import { describe, it, expect, vi } from "vitest";

const create = vi.fn();
const retrieve = vi.fn();

vi.mock("iyzipay", () => ({
  default: class {
    checkoutFormInitialize = { create };
    checkoutForm = { retrieve };
    static LOCALE = { TR: "tr", EN: "en" };
    static CURRENCY = { TRY: "TRY" };
    static PAYMENT_GROUP = { PRODUCT: "PRODUCT", LISTING: "LISTING", SUBSCRIPTION: "SUBSCRIPTION" };
    static BASKET_ITEM_TYPE = { PHYSICAL: "PHYSICAL", VIRTUAL: "VIRTUAL" };
  },
}));

import { createIyzipay, initializeCheckout, retrieveCheckout } from "./iyzipay-client";

describe("iyzipay-client", () => {
  it("resolves initializeCheckout with the SDK result", async () => {
    create.mockImplementation((_req, cb) => cb(null, { status: "success", token: "t1" }));
    const client = createIyzipay({ apiKey: "k", secretKey: "s", uri: "https://sandbox-api.iyzipay.com" });
    await expect(initializeCheckout(client, {})).resolves.toEqual({ status: "success", token: "t1" });
  });

  it("rejects initializeCheckout on SDK error", async () => {
    create.mockImplementation((_req, cb) => cb(new Error("network"), null));
    const client = createIyzipay({ apiKey: "k", secretKey: "s", uri: "u" });
    await expect(initializeCheckout(client, {})).rejects.toThrow("network");
  });

  it("resolves retrieveCheckout with the SDK result", async () => {
    retrieve.mockImplementation((_req, cb) => cb(null, { status: "success", paymentStatus: "SUCCESS" }));
    const client = createIyzipay({ apiKey: "k", secretKey: "s", uri: "u" });
    await expect(retrieveCheckout(client, { token: "t1" })).resolves.toEqual({
      status: "success",
      paymentStatus: "SUCCESS",
    });
  });
});
