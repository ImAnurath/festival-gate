import twilio from "twilio";
import type { WhatsAppSender, PayLinkVars, TicketsLinkVars } from "./types";

// Sends approved Utility templates (content SIDs) with two variables:
//   {{1}} = buyer name, {{2}} = pay link or tickets URL.
// The Twilio SDK throws on API failures, which the dispatch layer treats as
// best-effort (logs and continues).
export class TwilioWhatsAppSender implements WhatsAppSender {
  private client: ReturnType<typeof twilio>;
  constructor(
    accountSid: string,
    authToken: string,
    private from: string,
    private contentSid: string,
    private ticketsContentSid: string = ""
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

  async sendTicketsLink(toPhone: string, vars: TicketsLinkVars): Promise<void> {
    if (!this.ticketsContentSid) {
      throw new Error("TWILIO_TICKETS_CONTENT_SID is not configured");
    }
    await this.client.messages.create({
      from: `whatsapp:${this.from}`,
      to: `whatsapp:${toPhone}`,
      contentSid: this.ticketsContentSid,
      contentVariables: JSON.stringify({ "1": vars.name, "2": vars.ticketsUrl }),
    });
  }
}
