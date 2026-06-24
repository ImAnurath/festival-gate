import type { Notifier, EmailMessage } from "./types";

// Wraps a primary notifier (Resend) and a fallback (Gmail). If the primary fails
// for ANY reason, the same email is retried through the fallback. We do not
// inspect the error type: a Resend failure means it did not send, so retrying on
// Gmail delivers exactly one email in every real failure case. If the fallback
// also fails, its error propagates to notify(), which logs it and stays silent.
export class FallbackNotifier implements Notifier {
  constructor(
    private primary: Notifier,
    private fallback: Notifier,
  ) {}

  async send(to: string, message: EmailMessage): Promise<void> {
    try {
      await this.primary.send(to, message);
    } catch (err) {
      // Log why the primary failed so the reason is visible even when Gmail then
      // carries the send successfully.
      console.warn(`[notify] Resend send failed, falling back to Gmail:`, err);
      await this.fallback.send(to, message);
    }
  }
}
