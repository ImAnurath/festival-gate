import { z } from "zod";

const intString = z.string().regex(/^\d+$/, "must be an integer").transform(Number);

const schema = z.object({
  EVENT_NAME: z.string().min(1),
  TICKET_PRICE: intString,
  MAX_TICKETS_PER_BUYER: intString,
  PAY_TOKEN_TTL_HOURS: intString,
  PAYMENT_PROVIDER: z.enum(["stub", "iyzico"]),
  NOTIFIER: z.enum(["console", "resend"]),
  NEXT_PUBLIC_APP_URL: z.url(),
});

export type Config = {
  eventName: string;
  ticketPrice: number;
  maxTicketsPerBuyer: number;
  payTokenTtlHours: number;
  paymentProvider: "stub" | "iyzico";
  notifier: "console" | "resend";
  appUrl: string;
};

export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const p = schema.parse(env);
  return {
    eventName: p.EVENT_NAME,
    ticketPrice: p.TICKET_PRICE,
    maxTicketsPerBuyer: p.MAX_TICKETS_PER_BUYER,
    payTokenTtlHours: p.PAY_TOKEN_TTL_HOURS,
    paymentProvider: p.PAYMENT_PROVIDER,
    notifier: p.NOTIFIER,
    appUrl: p.NEXT_PUBLIC_APP_URL,
  };
}

export const config = loadConfig();
