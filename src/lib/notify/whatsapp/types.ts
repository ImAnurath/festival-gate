export type PayLinkVars = { name: string; payUrl: string; eventName: string };
export type TicketsLinkVars = { name: string; ticketsUrl: string; eventName: string };

export interface WhatsAppSender {
  sendPayLink(toPhone: string, vars: PayLinkVars): Promise<void>;
  sendTicketsLink(toPhone: string, vars: TicketsLinkVars): Promise<void>;
}
