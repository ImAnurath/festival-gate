import twilio from "twilio";
import type { WhatsAppSender, PayLinkVars } from "./types";

// Sends the approved Utility template (content SID) with two variables:
//   {{1}} = buyer name, {{2}} = pay link.
// The Twilio SDK throws on API failures, which the dispatch layer treats as
// best-effort (logs and continues).
export class TwilioWhatsAppSender implements WhatsAppSender {
  private client: ReturnType<typeof twilio>;
  constructor(
    accountSid: string,
    authToken: string,
    private from: string,
    private contentSid: string
  ) {
    this.client = twilio(accountSid, authToken);
  }

  async sendPayLink(toPhone: string, vars: PayLinkVars): Promise<void> {
    await this.client.messages.create({
      from: `whatsapp:${this.from}`,
      to: `whatsapp:${toPhone}`,
      contentSid: this.contentSid,
      contentVariables: JSON.stringify({ "1": vars.name, "2": vars.payUrl }),
    });
  }
}
