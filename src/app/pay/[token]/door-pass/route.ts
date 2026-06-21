import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { config } from "@/lib/config";
import { assertPayable } from "@/lib/state-machine";
import { issueTickets } from "@/lib/tickets";
import { dispatchTickets } from "@/lib/notify/dispatch";

// "Kapıda öde": the approved guest opts to pay at the door. Issue their QR pass
// now (tickets), but leave the application APPROVED (unpaid) — the gate collects
// payment on scan. Idempotent: issueTickets returns existing tickets on a repeat
// tap. Always redirects back to the pay page, which then shows the pass.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const back = () => NextResponse.redirect(`${config.appUrl}/pay/${token}`, 303);

  const app = await prisma.application.findUnique({ where: { payToken: token } });
  if (!app) return back();
  try {
    assertPayable(app, new Date());
  } catch {
    return back();
  }

  const tickets = await issueTickets(prisma, app);
  const updated = await prisma.application.findUniqueOrThrow({ where: { id: app.id } });
  // Best-effort delivery: a send failure must never undo issuance.
  try {
    await dispatchTickets(updated, tickets);
  } catch {
    // dispatchTickets is best-effort internally; guard anyway.
  }
  return back();
}
