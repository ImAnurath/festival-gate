import { prisma } from "./prisma";
import { config } from "./config";
import { approve, reject } from "./state-machine";
import { generatePayToken, expiryFromNow } from "./token";
import { issueTickets, checkInTicket, type CheckInResult } from "./tickets";

export class NotPayableError extends Error {
  constructor() {
    super("Application is not payable: unknown token, not approved, expired, or already paid");
    this.name = "NotPayableError";
  }
}

export type CreateInput = {
  name: string;
  email: string;
  phone?: string | null;
  socialTags: string;
  ticketQuantity: number;
  guestNames: string[];
  guestSocials: string[];
  childCount: number;
};

export async function createApplication(input: CreateInput) {
  return prisma.application.create({
    data: {
      name: input.name,
      email: input.email,
      phone: input.phone ?? null,
      socialTags: input.socialTags,
      ticketQuantity: input.ticketQuantity,
      guestNames: JSON.stringify(input.guestNames),
      guestSocials: JSON.stringify(input.guestSocials),
      childCount: input.childCount,
    },
  });
}

export async function approveApplication(id: string) {
  const app = await prisma.application.findUniqueOrThrow({ where: { id } });
  const next = approve(app.status as Parameters<typeof approve>[0]);
  return prisma.application.update({
    where: { id },
    data: {
      status: next,
      payToken: generatePayToken(),
      payTokenExpiresAt: expiryFromNow(config.payTokenTtlHours),
    },
  });
}

export async function rejectApplication(id: string) {
  const app = await prisma.application.findUniqueOrThrow({ where: { id } });
  const next = reject(app.status as Parameters<typeof reject>[0]);
  return prisma.application.update({ where: { id }, data: { status: next } });
}

// Re-issue a fresh payment token + expiry for an already-approved application
// (resend a link, or replace one that expired). The previous link stops working.
export async function reissuePayLink(id: string) {
  const app = await prisma.application.findUniqueOrThrow({ where: { id } });
  if (app.status !== "APPROVED") {
    throw new Error("Yalnızca onaylanmış başvurular için bağlantı yenilenebilir");
  }
  return prisma.application.update({
    where: { id },
    data: {
      payToken: generatePayToken(),
      payTokenExpiresAt: expiryFromNow(config.payTokenTtlHours),
    },
  });
}

// Mark an APPROVED application paid at the gate (organizer's bank POS terminal).
// Unlike markPaidByToken, this issues NO tickets and sends NO notifications: the
// guest is physically at the door. The amount is derived server-side and the
// paymentRef marker flags it as a door payment for reconciliation. The guarded
// updateMany (status APPROVED, paidAt null) makes a repeat tap a no-op rather
// than a double mark.
export async function markPaidAtDoor(id: string, now: Date = new Date()) {
  return prisma.$transaction(async (tx) => {
    const app = await tx.application.findUniqueOrThrow({ where: { id } });
    const amount = app.ticketQuantity * config.ticketPrice;
    const result = await tx.application.updateMany({
      where: { id, status: "APPROVED", paidAt: null },
      data: { status: "PAID", amount, paymentRef: "door-pos", paidAt: now },
    });
    if (result.count === 0) throw new NotPayableError();
    return tx.application.findUniqueOrThrow({ where: { id } });
  });
}

// Revert a mistaken door mark back to APPROVED. Gated on the door-pos marker,
// not ticket count: door-pass guests have tickets while unpaid, so ticket count
// no longer distinguishes door from online. Online payments carry a different
// paymentRef and stay un-undoable.
export async function undoDoorPayment(id: string) {
  return prisma.$transaction(async (tx) => {
    const app = await tx.application.findUniqueOrThrow({ where: { id } });
    // Gate on the door-pos marker, not ticket count: door-pass guests have
    // tickets while unpaid, so ticket count no longer distinguishes door from
    // online. Online payments carry a different paymentRef and stay un-undoable.
    if (app.status !== "PAID" || app.paymentRef !== "door-pos") {
      throw new NotPayableError();
    }
    // Reset any tickets checked in during the door collection back to VALID.
    await tx.ticket.updateMany({
      where: { applicationId: id, status: "USED" },
      data: { status: "VALID", checkedInAt: null },
    });
    await tx.application.update({
      where: { id },
      data: { status: "APPROVED", paidAt: null, amount: null, paymentRef: null },
    });
    return tx.application.findUniqueOrThrow({ where: { id } });
  });
}

// Door collection driven by the scanner: mark the whole application paid at the
// gate, then check the scanned ticket in. The other group members' tickets stay
// VALID and scan straight through (their application is now PAID). If the app is
// already paid (concurrent collect, or paid online), swallow NotPayableError and
// still check the ticket in.
export async function collectAtDoorAndCheckIn(
  applicationId: string,
  identifier: string,
  now: Date = new Date(),
): Promise<CheckInResult> {
  try {
    await markPaidAtDoor(applicationId, now);
  } catch (err) {
    if (!(err instanceof NotPayableError)) throw err;
  }
  return checkInTicket(identifier, now);
}

export async function markPaidByToken(payToken: string, paymentRef: string, amount: number) {
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    const result = await tx.application.updateMany({
      where: {
        payToken,
        status: "APPROVED",
        paidAt: null,
        payTokenExpiresAt: { gt: now },
      },
      data: { status: "PAID", paymentRef, amount, paidAt: now },
    });
    if (result.count === 0) {
      throw new NotPayableError();
    }
    const app = await tx.application.findUniqueOrThrow({ where: { payToken } });
    await issueTickets(tx, app);
    // Reload after issuance so the returned object carries the freshly-stamped
    // ticketsAccessToken and the issued tickets (SP3 delivery consumes both).
    return tx.application.findUniqueOrThrow({
      where: { payToken },
      include: { tickets: true },
    });
  });
}
