import { config } from "../config";
import type { Notifier, EmailMessage } from "./types";
import { ResendNotifier, ConsoleNotifier } from "./resend";
import { GmailNotifier } from "./gmail";
import { FallbackNotifier } from "./fallback";
import { attachInlineLogo } from "./email-layout";

type BuildOpts = {
  notifier: "console" | "resend" | "gmail";
  from: string;
  resendApiKey: string;
  gmailUser: string;
  gmailAppPassword: string;
};

// Pure factory so the wiring is unit-testable without the config singleton.
export function buildNotifier(opts: BuildOpts): Notifier {
  const { notifier, from, resendApiKey, gmailUser, gmailAppPassword } = opts;

  if (notifier === "gmail") {
    if (!gmailUser || !gmailAppPassword)
      throw new Error("GMAIL_USER and GMAIL_APP_PASSWORD are required when NOTIFIER=gmail");
    return new GmailNotifier(gmailUser, gmailAppPassword, from);
  }

  if (notifier === "resend") {
    if (!resendApiKey) throw new Error("RESEND_API_KEY is required when NOTIFIER=resend");
    const resend = new ResendNotifier(resendApiKey, from);
    // Auto-enable the Gmail fallback whenever Gmail creds are also configured.
    // No dedicated flag: presence of the creds is the switch.
    if (gmailUser && gmailAppPassword) {
      return new FallbackNotifier(resend, new GmailNotifier(gmailUser, gmailAppPassword, from));
    }
    return resend;
  }

  return new ConsoleNotifier();
}

export function getNotifier(): Notifier {
  return buildNotifier({
    notifier: config.notifier,
    from: process.env.MAIL_FROM ?? "Festival <tickets@example.com>",
    resendApiKey: process.env.RESEND_API_KEY ?? "",
    gmailUser: process.env.GMAIL_USER ?? "",
    gmailAppPassword: process.env.GMAIL_APP_PASSWORD ?? "",
  });
}

// Best-effort send: the email is a courtesy, never the source of truth. A send
// failure (Resend down, unverified domain, rate limit) must never break the
// state change that already happened. The admin copy-link button is the fallback.
export async function notify(to: string, message: EmailMessage): Promise<void> {
  try {
    await getNotifier().send(to, attachInlineLogo(message));
  } catch (err) {
    console.error(`[notify] send failed to=${to} subject="${message.subject}"`, err);
  }
}
