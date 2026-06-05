import { z } from "zod";

const intString = z.string().regex(/^\d+$/, "must be an integer").transform(Number);

const schema = z.object({
  EVENT_NAME: z.string().min(1),
  TICKET_PRICE: intString,
  MAX_TICKETS_PER_BUYER: intString,
  PAY_TOKEN_TTL_HOURS: intString,
  PAYMENT_PROVIDER: z.enum(["stub", "iyzico"]),
  NOTIFIER: z.enum(["console", "resend"]),
  APP_URL: z.url(),
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

// Resolve the public site URL. Prefer the explicit NEXT_PUBLIC_APP_URL, but fall
// back to Vercel's auto-provided production domain when it's missing or malformed
// (a stray quote/space in the dashboard value, or simply not set yet). Each
// candidate is trimmed and stripped of a trailing slash, then validated, so a
// bad manual value never blocks the build.
function resolveAppUrl(env: Record<string, string | undefined>): string | undefined {
  const candidates = [
    env.NEXT_PUBLIC_APP_URL,
    env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`
      : undefined,
  ];
  for (const candidate of candidates) {
    const cleaned = candidate?.trim().replace(/\/+$/, "");
    if (cleaned && z.url().safeParse(cleaned).success) return cleaned;
  }
  return undefined;
}

export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const p = schema.parse({ ...env, APP_URL: resolveAppUrl(env) });
  return {
    eventName: p.EVENT_NAME,
    ticketPrice: p.TICKET_PRICE,
    maxTicketsPerBuyer: p.MAX_TICKETS_PER_BUYER,
    payTokenTtlHours: p.PAY_TOKEN_TTL_HOURS,
    paymentProvider: p.PAYMENT_PROVIDER,
    notifier: p.NOTIFIER,
    appUrl: p.APP_URL,
  };
}

export const config = loadConfig();
