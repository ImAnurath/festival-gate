import { z } from "zod";

const intString = z.string().regex(/^\d+$/, "must be an integer").transform(Number);

const schema = z.object({
  SESSION_PASSWORD: z
    .string()
    .min(32, "SESSION_PASSWORD must be at least 32 characters (iron-session requirement)"),
  EVENT_NAME: z.string().min(1),
  TICKET_PRICE: intString,
  MAX_TICKETS_PER_BUYER: intString,
  PAY_TOKEN_TTL_HOURS: intString,
  PAYMENT_PROVIDER: z.enum(["stub", "iyzico"]),
  IYZICO_API_KEY: z.string().optional(),
  IYZICO_SECRET_KEY: z.string().optional(),
  IYZICO_BASE_URL: z.string().default("https://sandbox-api.iyzipay.com"),
  NOTIFIER: z.enum(["console", "resend", "gmail"]),
  WHATSAPP_PROVIDER: z.enum(["console", "twilio", "meta"]).default("console"),
  APP_URL: z.url(),
  EVENT_END: z.iso.datetime({ message: "EVENT_END must be an ISO datetime, e.g. 2026-09-01T21:00:00Z" }),
});

export type Config = {
  sessionPassword: string;
  eventName: string;
  ticketPrice: number;
  maxTicketsPerBuyer: number;
  payTokenTtlHours: number;
  paymentProvider: "stub" | "iyzico";
  iyzicoApiKey: string;
  iyzicoSecretKey: string;
  iyzicoBaseUrl: string;
  notifier: "console" | "resend" | "gmail";
  whatsappProvider: "console" | "twilio" | "meta";
  appUrl: string;
  eventEnd: Date;
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
    sessionPassword: p.SESSION_PASSWORD,
    eventName: p.EVENT_NAME,
    ticketPrice: p.TICKET_PRICE,
    maxTicketsPerBuyer: p.MAX_TICKETS_PER_BUYER,
    payTokenTtlHours: p.PAY_TOKEN_TTL_HOURS,
    paymentProvider: p.PAYMENT_PROVIDER,
    iyzicoApiKey: p.IYZICO_API_KEY ?? "",
    iyzicoSecretKey: p.IYZICO_SECRET_KEY ?? "",
    iyzicoBaseUrl: p.IYZICO_BASE_URL,
    notifier: p.NOTIFIER,
    whatsappProvider: p.WHATSAPP_PROVIDER,
    appUrl: p.APP_URL,
    eventEnd: new Date(p.EVENT_END),
  };
}

export const config = loadConfig();
