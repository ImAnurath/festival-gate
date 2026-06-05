import type { WhatsAppSender, PayLinkVars } from "./types";

export class ConsoleWhatsAppSender implements WhatsAppSender {
  async sendPayLink(toPhone: string, vars: PayLinkVars): Promise<void> {
    console.log(
      `[whatsapp] to=${toPhone} ${vars.eventName} pay link for ${vars.name}: ${vars.payUrl}`
    );
  }
}
