import Iyzipay from "iyzipay";

export type IyzipayResult = Record<string, unknown> & {
  status?: string;
  errorMessage?: string;
  token?: string;
  paymentPageUrl?: string;
  paymentStatus?: string;
  paymentId?: string;
  basketId?: string;
  conversationId?: string;
  paidPrice?: string;
};

export function createIyzipay(opts: { apiKey: string; secretKey: string; uri: string }): Iyzipay {
  return new Iyzipay(opts);
}

export function initializeCheckout(
  client: Iyzipay,
  request: Record<string, unknown>
): Promise<IyzipayResult> {
  return new Promise((resolve, reject) => {
    client.checkoutFormInitialize.create(request, (err, result) => {
      if (err) reject(err);
      else resolve(result as IyzipayResult);
    });
  });
}

export function retrieveCheckout(
  client: Iyzipay,
  request: Record<string, unknown>
): Promise<IyzipayResult> {
  return new Promise((resolve, reject) => {
    client.checkoutForm.retrieve(request, (err, result) => {
      if (err) reject(err);
      else resolve(result as IyzipayResult);
    });
  });
}
