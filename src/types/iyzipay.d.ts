// Minimal type shim for the untyped `iyzipay` SDK — only the surface we use.
declare module "iyzipay" {
  type IyzipayCallback = (err: unknown, result: Record<string, unknown>) => void;

  class Iyzipay {
    constructor(options: { apiKey: string; secretKey: string; uri: string });
    checkoutFormInitialize: {
      create(request: Record<string, unknown>, cb: IyzipayCallback): void;
    };
    checkoutForm: {
      retrieve(request: Record<string, unknown>, cb: IyzipayCallback): void;
    };
    static LOCALE: { TR: string; EN: string };
    static CURRENCY: { TRY: string };
    static PAYMENT_GROUP: { PRODUCT: string; LISTING: string; SUBSCRIPTION: string };
    static BASKET_ITEM_TYPE: { PHYSICAL: string; VIRTUAL: string };
  }

  export = Iyzipay;
}
