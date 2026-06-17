import type { WhatsAppSender, PayLinkVars, TicketsLinkVars } from "./types";

// Sends approved WhatsApp templates via Meta's WhatsApp Cloud API directly
// (no BSP/Twilio in between). Templates carry two body variables:
//   {{1}} = buyer name, {{2}} = pay link or tickets URL.
//
// A non-2xx response throws; the dispatch layer treats that as best-effort
// (logs and continues, falling back to the admin copy-link button).
export class MetaWhatsAppSender implements WhatsAppSender {
  constructor(
    private phoneNumberId: string,
    private accessToken: string,
    private templateName: string,
    private templateLang: string,
    private ticketsTemplateName: string = "",
    private ticketsTemplateLang: string = "tr",
    private graphVersion: string = "v21.0"
  ) {}

  private async postTemplate(
    toPhone: string,
    name: string,
    lang: string,
    var1: string,
    var2: string
  ): Promise<void> {
    const url = `https://graph.facebook.com/${this.graphVersion}/${this.phoneNumberId}/messages`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        // Meta expects the number in international format without a leading "+".
        to: toPhone.replace(/^\+/, ""),
        type: "template",
        template: {
          name,
          language: { code: lang },
          components: [
            {
              type: "body",
              parameters: [
                { type: "text", text: var1 },
                { type: "text", text: var2 },
              ],
            },
          ],
        },
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`Meta WhatsApp send failed (${res.status}): ${detail}`);
    }
  }

  async sendPayLink(toPhone: string, vars: PayLinkVars): Promise<void> {
    await this.postTemplate(toPhone, this.templateName, this.templateLang, vars.name, vars.payUrl);
  }

  async sendTicketsLink(toPhone: string, vars: TicketsLinkVars): Promise<void> {
    if (!this.ticketsTemplateName) {
      throw new Error("WHATSAPP_TICKETS_TEMPLATE is not configured");
    }
    await this.postTemplate(toPhone, this.ticketsTemplateName, this.ticketsTemplateLang, vars.name, vars.ticketsUrl);
  }
}
