import { NextRequest, NextResponse } from "next/server";
import type { Application, Ticket } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { config } from "@/lib/config";
import { getPaymentProvider } from "@/lib/payment";
import {
  markPaidByToken,
  loadUndeliveredPaid,
  stampTicketsDelivered,
  NotPayableError,
} from "@/lib/applications";
import { isShowcaseToken } from "@/lib/payment/showcase";
import { dispatchTickets } from "@/lib/notify/dispatch";

// Send the post-payment tickets notification exactly once. dispatchTickets is
// internally best-effort (it never throws on a send failure), so the real thing
// this guards against is a crash/timeout between marking paid and dispatching:
// the next webhook retry redelivers because ticketsDeliveredAt is still unset.
// (A rare double-send is possible if two retries race; that is harmless.)
async function deliverTicketsOnce(app: Application & { tickets: Ticket[] }) {
  if (app.ticketsDeliveredAt) return;
  await dispatchTickets(app, app.tickets);
  await stampTicketsDelivered(app.id);
}

// The callback serves two callers: the stub's /confirm route (JSON in, JSON out)
// and iyzico's hosted page (form POST from the buyer's browser, expects a redirect).
async function readPayload(req: NextRequest): Promise<{ payload: unknown; isBrowser: boolean }> {
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return { payload: await req.json().catch(() => ({})), isBrowser: false };
  }
  const form = await req.formData().catch(() => null);
  return { payload: form ? Object.fromEntries(form) : {}, isBrowser: true };
}

export async function POST(req: NextRequest) {
  const { payload, isBrowser } = await readPayload(req);
  const result = await getPaymentProvider().verifyCallback(payload);

  const redirectTo = (token: string) =>
    NextResponse.redirect(`${config.appUrl}/pay/${token}`, 303);

  if (!result.ok) {
    return isBrowser ? redirectTo(result.payToken || "") : NextResponse.json({ ok: false }, { status: 400 });
  }

  // The reviewer's demo page must never be consumed: skip marking it paid so it
  // stays payable for the next review.
  if (isShowcaseToken(result.payToken)) {
    return isBrowser ? redirectTo(result.payToken) : NextResponse.json({ ok: true, note: "showcase" });
  }

  const app = await prisma.application.findUnique({ where: { payToken: result.payToken } });
  if (!app) {
    return isBrowser ? redirectTo(result.payToken) : NextResponse.json({ ok: false }, { status: 404 });
  }

  const expected = app.ticketQuantity * config.ticketPrice;
  if (result.paidAmount !== undefined && result.paidAmount !== expected) {
    // Charged amount does not match what we expected: do not mark paid.
    return isBrowser
      ? redirectTo(result.payToken)
      : NextResponse.json({ ok: false, note: "amount-mismatch" }, { status: 400 });
  }

  let paid;
  try {
    paid = await markPaidByToken(result.payToken, result.ref, expected);
  } catch (err) {
    if (err instanceof NotPayableError) {
      // Already paid, expired, or unknown -> idempotent no-op. But if a prior
      // attempt marked it paid then died before sending the tickets, redeliver
      // now (loadUndeliveredPaid returns null once delivery has been stamped).
      const pending = await loadUndeliveredPaid(result.payToken);
      if (pending) await deliverTicketsOnce(pending);
      return isBrowser
        ? redirectTo(result.payToken)
        : NextResponse.json({ ok: true, note: "no-op" });
    }
    // Genuine failure (e.g. database error): do NOT report success — let it surface.
    throw err;
  }

  await deliverTicketsOnce(paid);

  return isBrowser ? redirectTo(result.payToken) : NextResponse.json({ ok: true });
}
