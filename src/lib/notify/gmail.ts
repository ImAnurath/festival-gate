import nodemailer, { type Transporter } from "nodemailer";
import type { Notifier, EmailMessage } from "./types";

// Sends mail through Gmail's SMTP using a 16-char App Password (the Gmail account
// must have 2-Step Verification enabled to mint one). No custom domain required.
// Daily cap is ~500 recipients, comfortably above this event's scale.
export class GmailNotifier implements Notifier {
  private transporter: Transporter;
  constructor(user: string, appPassword: string, private from: string) {
    this.transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user, pass: appPassword },
    });
  }
  async send(to: string, message: EmailMessage): Promise<void> {
    // sendMail rejects on auth/connection/recipient failures, which the
    // best-effort notify() wrapper catches and logs. Gmail requires `from` to be
    // the authenticated account (or one of its verified aliases).
    await this.transporter.sendMail({
      from: this.from,
      to,
      subject: message.subject,
      text: message.text,
      // Nodemailer takes { filename, content: Buffer } directly. Only set the
      // field when present so plain emails are unchanged.
      ...(message.attachments?.length ? { attachments: message.attachments } : {}),
    });
  }
}
