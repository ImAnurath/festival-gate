import type { WhatsAppSender, PayLinkVars, TicketsLinkVars } from "./types";

// Sends approved WhatsApp templates via Meta's WhatsApp Cloud API directly
// (no BSP/Twilio in between). The rich templates carry three components:
//   - header: an image (the KİNDZİ FEST logo, served from the public site)
//   - body:   one variable, {{1}} = buyer name
//   - button: a dynamic URL button whose {{1}} is the link path suffix
//             (e.g. "pay/<token>" or "tickets/<token>"), appended in the
//             approved template to the hardcoded base "https://<domain>/{{1}}".
//
// A non-2xx response throws; the dispatch layer treats that as best-effort
// (logs and continues, falling back to the admin copy-link button).
export class MetaWhatsAppSender implements WhatsAppSender {
  private readonly appUrl: string;

  constructor(
    private phoneNumberId: string,
    private accessToken: string,
    appUrl: string,
    private templateName: string,
    private templateLang: string,
    private ticketsTemplateName: string = "",
    private ticketsTemplateLang: string = "tr",
    private graphVersion: string = "v21.0"
  ) {
    // Strip any trailing slash so we can safely append "/email/...".
    this.appUrl = appUrl.replace(/\/+$/, "");
  }

  // The inline logo header is the same image used by the branded emails.
  private logoUrl(): string {
    return `${this.appUrl}/email/kindzi-fest-logo.png`;
  }

  // Dynamic URL buttons receive only the suffix that fills the template's
  // "https://<domain>/{{1}}" base — i.e. the path after the origin.
  private urlSuffix(fullUrl: string): string {
    try {
      const u = new URL(fullUrl);
      return `${u.pathname}${u.search}`.replace(/^\//, "");
    } catch {
      return fullUrl.replace(/^https?:\/\/[^/]+\//, "");
    }
  }

  private async postTemplate(
    toPhone: string,
    name: string,
    lang: string,
    buyerName: string,
    fullUrl: string
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
              type: "header",
              parameters: [{ type: "image", image: { link: this.logoUrl() } }],
            },
            {
              type: "body",
              parameters: [{ type: "text", text: buyerName }],
            },
            {
              type: "button",
              sub_type: "url",
              index: "0",
              parameters: [{ type: "text", text: this.urlSuffix(fullUrl) }],
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
