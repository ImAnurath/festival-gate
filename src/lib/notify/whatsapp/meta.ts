import type { WhatsAppSender, PayLinkVars } from "./types";

// Sends the approved pay-link template via Meta's WhatsApp Cloud API directly
// (no BSP/Twilio in between). The template is referenced by name + language and
// carries two body variables: {{1}} = buyer name, {{2}} = pay link.
//
// A non-2xx response throws; the dispatch layer treats that as best-effort
// (logs and continues, falling back to the admin copy-link button).
export class MetaWhatsAppSender implements WhatsAppSender {
  constructor(
    private phoneNumberId: string,
    private accessToken: string,
    private templateName: string,
    private templateLang: string,
    private graphVersion: string = "v21.0"
  ) {}

  async sendPayLink(toPhone: string, vars: PayLinkVars): Promise<void> {
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
          name: this.templateName,
          language: { code: this.templateLang },
          components: [
            {
              type: "body",
              parameters: [
                { type: "text", text: vars.name },
                { type: "text", text: vars.payUrl },
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
}
