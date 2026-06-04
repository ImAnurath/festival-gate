export type CheckoutInput = {
  applicationId: string;
  amount: number; // integer, in the smallest sensible unit (whole TRY here)
  email: string;
  payToken: string;
};

export type CheckoutSession = {
  url: string; // where to send the buyer to pay
  ref: string; // provider-side reference
};

export type CallbackResult = {
  ok: boolean;
  payToken: string;
  ref: string;
};

export interface PaymentProvider {
  createCheckout(input: CheckoutInput): Promise<CheckoutSession>;
  verifyCallback(payload: unknown): Promise<CallbackResult>;
}
