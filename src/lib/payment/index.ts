import { config } from "../config";
import type { PaymentProvider } from "./types";
import { StubPaymentProvider } from "./stub";
import { IyzicoPaymentProvider } from "./iyzico";

export function getPaymentProvider(): PaymentProvider {
  switch (config.paymentProvider) {
    case "stub":
      return new StubPaymentProvider(config.appUrl);
    case "iyzico":
      return new IyzicoPaymentProvider({
        apiKey: config.iyzicoApiKey,
        secretKey: config.iyzicoSecretKey,
        baseUrl: config.iyzicoBaseUrl,
        appUrl: config.appUrl,
        eventName: config.eventName,
      });
    default:
      throw new Error(`Unknown payment provider: ${config.paymentProvider}`);
  }
}
