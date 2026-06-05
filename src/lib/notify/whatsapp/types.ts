export type PayLinkVars = { name: string; payUrl: string; eventName: string };

export interface WhatsAppSender {
  sendPayLink(toPhone: string, vars: PayLinkVars): Promise<void>;
}
