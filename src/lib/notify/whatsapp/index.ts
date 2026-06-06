import { config } from "../../config";
import type { WhatsAppSender } from "./types";
import { ConsoleWhatsAppSender } from "./console";
import { TwilioWhatsAppSender } from "./twilio";
import { MetaWhatsAppSender } from "./meta";

export function getWhatsAppSender(): WhatsAppSender {
  if (config.whatsappProvider === "meta") {
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID ?? "";
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN ?? "";
    const template = process.env.WHATSAPP_PAYLINK_TEMPLATE ?? "";
    const lang = process.env.WHATSAPP_PAYLINK_TEMPLATE_LANG ?? "tr";
    if (!phoneNumberId || !accessToken || !template) {
      throw new Error(
        "WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_ACCESS_TOKEN and WHATSAPP_PAYLINK_TEMPLATE are required when WHATSAPP_PROVIDER=meta"
      );
    }
    return new MetaWhatsAppSender(phoneNumberId, accessToken, template, lang);
  }

  if (config.whatsappProvider === "twilio") {
    const accountSid = process.env.TWILIO_ACCOUNT_SID ?? "";
    const authToken = process.env.TWILIO_AUTH_TOKEN ?? "";
    const from = process.env.TWILIO_WHATSAPP_FROM ?? "";
    const contentSid = process.env.TWILIO_PAYLINK_CONTENT_SID ?? "";
    if (!accountSid || !authToken || !from || !contentSid) {
      throw new Error(
        "TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM and TWILIO_PAYLINK_CONTENT_SID are required when WHATSAPP_PROVIDER=twilio"
      );
    }
    return new TwilioWhatsAppSender(accountSid, authToken, from, contentSid);
  }
  return new ConsoleWhatsAppSender();
}
