import { config } from "../config";
import { notify } from "./index";
import { buildApprovalEmail } from "./types";
import { getWhatsAppSender } from "./whatsapp";

// Deliver the approval pay link. WhatsApp when a phone is present, email
// otherwise. Both channels are best-effort: a send failure logs and never
// breaks the caller (the application is already approved in the DB, and the
// admin copy-link button is the final fallback).
export async function dispatchPayLink(
  app: { name: string; email: string; phone: string | null },
  payUrl: string
): Promise<void> {
  if (app.phone) {
    try {
      await getWhatsAppSender().sendPayLink(app.phone, {
        name: app.name,
        payUrl,
        eventName: config.eventName,
      });
    } catch (err) {
      console.error(`[dispatch] whatsapp send failed to=${app.phone}`, err);
    }
    return;
  }

  // notify() is already best-effort (it catches and logs internally).
  await notify(
    app.email,
    buildApprovalEmail({ eventName: config.eventName, name: app.name, payUrl })
  );
}
