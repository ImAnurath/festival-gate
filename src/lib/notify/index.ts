import { config } from "../config";
import type { Notifier } from "./types";
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
