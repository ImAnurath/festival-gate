import type { Ticket } from "@prisma/client";
import { config } from "../config";
import { renderTicketsPdf } from "../pdf/tickets-pdf";
import { notify } from "./index";
import { buildApprovalEmail, buildTicketsEmail } from "./types";
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

// Deliver the paid tickets: ALWAYS email (the PDF is attached there), and
// ADDITIONALLY WhatsApp a retrieval link when a phone is present. Every channel
// is best-effort — a failure logs and never undoes the recorded payment.
export async function dispatchTickets(
  app: { name: string; email: string; phone: string | null; ticketsAccessToken: string | null },
  tickets: Ticket[]
): Promise<void> {
  // Issuance always stamps ticketsAccessToken in the same transaction that marks
  // the application paid, so this should never be null on the real path. Guard
  // anyway: without it we'd email a dead ".../tickets/null" link. Fail loudly.
  if (!app.ticketsAccessToken) {
    console.error(`[dispatch] tickets delivery skipped: no ticketsAccessToken for ${app.email}`);
    return;
  }

  const ticketsUrl = `${config.appUrl}/tickets/${app.ticketsAccessToken}`;

  // Email (with PDF attachment). notify() is already best-effort internally.
  try {
    const pdf = await renderTicketsPdf({ name: app.name }, tickets);
    await notify(app.email, {
      ...buildTicketsEmail({ eventName: config.eventName, name: app.name, ticketsUrl }),
      attachments: [{ filename: "kindzi-fest-biletleri.pdf", content: pdf }],
    });
  } catch (err) {
    console.error(`[dispatch] tickets email failed to=${app.email}`, err);
  }

  // WhatsApp link (only when a phone is present).
  if (app.phone) {
    try {
      await getWhatsAppSender().sendTicketsLink(app.phone, {
        name: app.name,
        ticketsUrl,
        eventName: config.eventName,
      });
    } catch (err) {
      console.error(`[dispatch] tickets whatsapp send failed to=${app.phone}`, err);
    }
  }
}
