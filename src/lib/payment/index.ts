import { config } from "../config";
import type { PaymentProvider } from "./types";
import { StubPaymentProvider } from "./stub";

export function getPaymentProvider(): PaymentProvider {
  switch (config.paymentProvider) {
    case "stub":
      return new StubPaymentProvider(config.appUrl);
    case "iyzico":
      throw new Error("iyzico provider not implemented yet");
    default:
      throw new Error(`Unknown payment provider: ${config.paymentProvider}`);
  }
}
