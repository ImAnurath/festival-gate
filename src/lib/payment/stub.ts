import { randomBytes } from "node:crypto";
import type { PaymentProvider, CheckoutInput, CheckoutSession, CallbackResult } from "./types";

export class StubPaymentProvider implements PaymentProvider {
  constructor(private appUrl: string) {}

  async createCheckout(input: CheckoutInput): Promise<CheckoutSession> {
    return {
      url: `${this.appUrl}/pay/${input.payToken}/confirm`,
      ref: `stub_${randomBytes(8).toString("hex")}`,
    };
  }

  async verifyCallback(payload: unknown): Promise<CallbackResult> {
    const p = (payload ?? {}) as { payToken?: string; ref?: string };
    if (!p.payToken) return { ok: false, payToken: "", ref: p.ref ?? "" };
    return { ok: true, payToken: p.payToken, ref: p.ref ?? "" };
  }
}
