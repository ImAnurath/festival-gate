import Iyzipay from "iyzipay";
import type { PaymentProvider, CheckoutInput, CheckoutSession, CallbackResult } from "./types";
import { createIyzipay, initializeCheckout, retrieveCheckout } from "./iyzipay-client";

export type IyzicoConfig = {
  apiKey: string;
  secretKey: string;
  baseUrl: string;
  appUrl: string;
  eventName: string;
};

export class IyzicoPaymentProvider implements PaymentProvider {
  private readonly client: Iyzipay;

  constructor(private readonly cfg: IyzicoConfig) {
    if (!cfg.apiKey || !cfg.secretKey) {
      throw new Error("iyzico API anahtarları eksik (IYZICO_API_KEY / IYZICO_SECRET_KEY)");
    }
    this.client = createIyzipay({ apiKey: cfg.apiKey, secretKey: cfg.secretKey, uri: cfg.baseUrl });
  }

  async createCheckout(input: CheckoutInput): Promise<CheckoutSession> {
    const price = input.amount.toString();
    const [firstName, ...rest] = input.name.trim().split(/\s+/);
    const surname = rest.join(" ") || firstName || "-";

    const buyer = {
      id: input.applicationId,
      name: firstName || input.name,
      surname,
      identityNumber: "11111111111", // iyzico requires a TC field; not collected, placeholder for card flow
      email: input.email,
      registrationAddress: "Fatsa, Ordu",
      ip: "85.34.78.112",
      city: "Ordu",
      country: "Turkey",
    };
    const address = { contactName: input.name, city: "Ordu", country: "Turkey", address: "Fatsa, Ordu" };

    const request = {
      locale: Iyzipay.LOCALE.TR,
      conversationId: input.payToken,
      basketId: input.payToken,
      price,
      paidPrice: price,
      currency: Iyzipay.CURRENCY.TRY,
      paymentGroup: Iyzipay.PAYMENT_GROUP.PRODUCT,
      callbackUrl: `${this.cfg.appUrl}/api/payment/callback`,
      buyer,
      shippingAddress: address,
      billingAddress: address,
      basketItems: [
        {
          id: "TICKET",
          name: `${this.cfg.eventName} Bilet`,
          category1: "Etkinlik",
          itemType: Iyzipay.BASKET_ITEM_TYPE.VIRTUAL,
          price,
        },
      ],
    };

    const result = await initializeCheckout(this.client, request);
    if (result.status !== "success" || !result.paymentPageUrl) {
      throw new Error(result.errorMessage ?? "iyzico ödeme başlatılamadı");
    }
    return { url: result.paymentPageUrl, ref: result.token ?? "" };
  }

  async verifyCallback(payload: unknown): Promise<CallbackResult> {
    const token = (payload as { token?: string } | null)?.token;
    if (!token) return { ok: false, payToken: "", ref: "" };

    const result = await retrieveCheckout(this.client, { locale: Iyzipay.LOCALE.TR, token });
    const ok = result.status === "success" && result.paymentStatus === "SUCCESS";
    return {
      ok,
      payToken: result.basketId ?? "",
      ref: result.paymentId ?? token,
      paidAmount: result.paidPrice !== undefined ? Number(result.paidPrice) : undefined,
    };
  }
}
