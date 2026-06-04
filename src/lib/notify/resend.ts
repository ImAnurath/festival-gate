import { Resend } from "resend";
import type { Notifier, EmailMessage } from "./types";

export class ResendNotifier implements Notifier {
  private client: Resend;
  constructor(apiKey: string, private from: string) {
    this.client = new Resend(apiKey);
  }
  async send(to: string, message: EmailMessage): Promise<void> {
    await this.client.emails.send({
      from: this.from,
      to,
      subject: message.subject,
      text: message.text,
    });
  }
}

export class ConsoleNotifier implements Notifier {
  async send(to: string, message: EmailMessage): Promise<void> {
    console.log(`[email] to=${to} subject="${message.subject}"\n${message.text}`);
  }
}
