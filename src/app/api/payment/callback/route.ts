import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { config } from "@/lib/config";
import { getPaymentProvider } from "@/lib/payment";
import { markPaidByToken } from "@/lib/applications";
import { isShowcaseToken } from "@/lib/payment/showcase";
import { notify } from "@/lib/notify";
import { buildConfirmationEmail } from "@/lib/notify/types";

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

  try {
    const paid = await markPaidByToken(result.payToken, result.ref, expected);
    // Payment is recorded. The confirmation email is best-effort; a send failure
    // must never undo or mask the paid result.
    await notify(
      paid.email,
      buildConfirmationEmail({
        eventName: config.eventName,
        name: paid.name,
        ticketQuantity: paid.ticketQuantity,
      })
    );
  } catch {
    // Not payable: already paid, expired, or unknown -> idempotent no-op.
  }

  return isBrowser ? redirectTo(result.payToken) : NextResponse.json({ ok: true });
}
