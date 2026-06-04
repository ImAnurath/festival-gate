import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { config } from "@/lib/config";
import { getPaymentProvider } from "@/lib/payment";
import { markPaidByToken } from "@/lib/applications";
import { getNotifier } from "@/lib/notify";
import { buildConfirmationEmail } from "@/lib/notify/types";

export async function POST(req: NextRequest) {
  const payload = await req.json().catch(() => ({}));
  const result = await getPaymentProvider().verifyCallback(payload);
  if (!result.ok) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const app = await prisma.application.findUnique({ where: { payToken: result.payToken } });
  if (!app) return NextResponse.json({ ok: false }, { status: 404 });

  const amount = app.ticketQuantity * config.ticketPrice;

  try {
    const paid = await markPaidByToken(result.payToken, result.ref, amount);
    await getNotifier().send(paid.email, buildConfirmationEmail({
      eventName: config.eventName,
      name: paid.name,
      ticketQuantity: paid.ticketQuantity,
    }));
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true, note: "no-op" });
  }
}
