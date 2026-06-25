import type { Ticket } from "@prisma/client";
import { config } from "../config";
import { renderTicketsPdf, renderPaidTicketsPdf } from "../pdf/tickets-pdf";
import { notify } from "./index";
import { buildApprovalEmail, buildTicketsEmail, buildGatePassEmail } from "./types";
import type { EmailMessage } from "./types";
import { getWhatsAppSender } from "./whatsapp";

// Deliver the approval pay link on every channel the applicant gave us: email
// when an email is present, WhatsApp when a phone is present, both when both
// are. Each channel is best-effort: a send failure logs and never breaks the
// caller (the application is already approved in the DB, and the admin
// copy-link button is the final fallback).
export async function dispatchPayLink(
  app: { name: string; email: string; phone: string | null },
  payUrl: string
): Promise<void> {
  // Email channel. notify() is already best-effort (it catches and logs internally).
  if (app.email) {
    await notify(
      app.email,
      buildApprovalEmail({ eventName: config.eventName, name: app.name, payUrl })
    );
  }

  // WhatsApp channel.
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
  }
}

type DeliverableApp = {
  name: string;
  email: string;
  phone: string | null;
  ticketsAccessToken: string | null;
};

// Shared delivery for any QR pass: ALWAYS email (PDF attached), and ADDITIONALLY
// WhatsApp a retrieval link when a phone is present. Every channel is
// best-effort — a failure logs and never undoes ticket issuance. `buildEmail`
// selects the copy (paid tickets vs. pay-at-the-gate) and `context` labels logs.
async function deliverPass(
  app: DeliverableApp,
  tickets: Ticket[],
  buildEmail: (p: { eventName: string; name: string; ticketsUrl: string }) => EmailMessage,
  renderPdf: (a: Pick<DeliverableApp, "name">, t: Ticket[]) => Promise<Buffer>,
  context: string,
): Promise<void> {
  // Issuance always stamps ticketsAccessToken in the same transaction that issues
  // the tickets, so this should never be null on the real path. Guard anyway:
  // without it we'd email a dead ".../tickets/null" link. Fail loudly.
  if (!app.ticketsAccessToken) {
    console.error(`[dispatch] ${context} delivery skipped: no ticketsAccessToken for ${app.email}`);
    return;
  }

  const ticketsUrl = `${config.appUrl}/tickets/${app.ticketsAccessToken}`;

  // Email (with PDF attachment). notify() is already best-effort internally.
  try {
    const pdf = await renderPdf({ name: app.name }, tickets);
    await notify(app.email, {
      ...buildEmail({ eventName: config.eventName, name: app.name, ticketsUrl }),
      attachments: [{ filename: "kindzi-fest-biletleri.pdf", content: pdf }],
    });
  } catch (err) {
    console.error(`[dispatch] ${context} email failed to=${app.email}`, err);
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
      console.error(`[dispatch] ${context} whatsapp send failed to=${app.phone}`, err);
    }
  }
}

// Deliver the paid tickets (new artwork ticket).
export async function dispatchTickets(app: DeliverableApp, tickets: Ticket[]): Promise<void> {
  return deliverPass(app, tickets, buildTicketsEmail, renderPaidTicketsPdf, "tickets");
}

// Deliver an unpaid "pay at the gate" QR pass (keeps the original ticket design).
export async function dispatchGatePass(app: DeliverableApp, tickets: Ticket[]): Promise<void> {
  return deliverPass(app, tickets, buildGatePassEmail, renderTicketsPdf, "gate pass");
}
