import { Resend } from "resend";
import type { Notifier, EmailMessage } from "./types";

export class ResendNotifier implements Notifier {
  private client: Resend;
  constructor(apiKey: string, private from: string) {
    this.client = new Resend(apiKey);
  }
  async send(to: string, message: EmailMessage): Promise<void> {
    // Resend's SDK resolves with { data, error } and does NOT throw on API-level
    // failures (bad domain, invalid recipient, rate limit). Surface those as a
    // thrown error so the best-effort notify() wrapper can log them.
    const { error } = await this.client.emails.send({
      from: this.from,
      to,
      subject: message.subject,
      text: message.text,
      ...(message.html ? { html: message.html } : {}),
      // Resend's SDK takes camelCase contentId (→ content_id) and contentType.
      ...(message.attachments?.length
        ? {
            attachments: message.attachments.map((a) => ({
              filename: a.filename,
              content: a.content,
              ...(a.cid ? { contentId: a.cid } : {}),
              ...(a.contentType ? { contentType: a.contentType } : {}),
            })),
          }
        : {}),
    });
    if (error) throw new Error(`Resend send failed: ${error.name}: ${error.message}`);
  }
}

export class ConsoleNotifier implements Notifier {
  async send(to: string, message: EmailMessage): Promise<void> {
    const atts = message.attachments?.length
      ? ` [attachments: ${message.attachments.map((a) => `${a.filename} (${a.content.length}b)`).join(", ")}]`
      : "";
    console.log(`[email] to=${to} subject="${message.subject}"${atts}\n${message.text}`);
  }
}
