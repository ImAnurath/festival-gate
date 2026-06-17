import type { WhatsAppSender, PayLinkVars, TicketsLinkVars } from "./types";

export class ConsoleWhatsAppSender implements WhatsAppSender {
  async sendPayLink(toPhone: string, vars: PayLinkVars): Promise<void> {
    console.log(`[whatsapp] to=${toPhone} ${vars.eventName} pay link for ${vars.name}: ${vars.payUrl}`);
  }
  async sendTicketsLink(toPhone: string, vars: TicketsLinkVars): Promise<void> {
    console.log(`[whatsapp] to=${toPhone} ${vars.eventName} tickets link for ${vars.name}: ${vars.ticketsUrl}`);
  }
}
