import { config } from "../config";
import type { Notifier, EmailMessage } from "./types";
import { ResendNotifier, ConsoleNotifier } from "./resend";

export function getNotifier(): Notifier {
  if (config.notifier === "resend") {
    const apiKey = process.env.RESEND_API_KEY ?? "";
    const from = process.env.MAIL_FROM ?? "Festival <tickets@example.com>";
    if (!apiKey) throw new Error("RESEND_API_KEY is required when NOTIFIER=resend");
    return new ResendNotifier(apiKey, from);
  }
  return new ConsoleNotifier();
}

// Best-effort send: the email is a courtesy, never the source of truth. A send
// failure (Resend down, unverified domain, rate limit) must never break the
// state change that already happened. The admin copy-link button is the fallback.
export async function notify(to: string, message: EmailMessage): Promise<void> {
  try {
    await getNotifier().send(to, message);
  } catch (err) {
    console.error(`[notify] send failed to=${to} subject="${message.subject}"`, err);
  }
}
