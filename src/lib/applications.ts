import { prisma } from "./prisma";
import { config } from "./config";
import { TransitionError } from "./state-machine";
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

// Atomic guarded transition (only PENDING -> APPROVED, per state-machine
// `approve`). The where-clause is the concurrency boundary: two admins acting
// at once can't both "win" or clobber a concurrent reject. count === 0 means
// the row was no longer PENDING.
export async function approveApplication(id: string) {
  const result = await prisma.application.updateMany({
    where: { id, status: "PENDING" },
    data: {
      status: "APPROVED",
      payToken: generatePayToken(),
      payTokenExpiresAt: expiryFromNow(config.payTokenTtlHours),
    },
  });
  if (result.count === 0) {
    throw new TransitionError("Başvuru onaylanamıyor (zaten işlenmiş olabilir)");
  }
  return prisma.application.findUniqueOrThrow({ where: { id } });
}

// Atomic guarded transition (any non-PAID state -> REJECTED, per state-machine
// `reject`). A PAID application (or one paid concurrently) is left untouched.
export async function rejectApplication(id: string) {
  const result = await prisma.application.updateMany({
    where: { id, status: { not: "PAID" } },
    data: { status: "REJECTED" },
  });
  if (result.count === 0) {
    throw new TransitionError("Ödenmiş başvuru reddedilemez");
  }
  return prisma.application.findUniqueOrThrow({ where: { id } });
}

// Re-issue a fresh payment token + expiry for an already-approved application
// (resend a link, or replace one that expired). The previous link stops working.
// Atomic guard on APPROVED so it can't race a concurrent reject/payment.
export async function reissuePayLink(id: string) {
  const result = await prisma.application.updateMany({
    where: { id, status: "APPROVED" },
    data: {
      payToken: generatePayToken(),
      payTokenExpiresAt: expiryFromNow(config.payTokenTtlHours),
    },
  });
  if (result.count === 0) {
    throw new Error("Yalnızca onaylanmış başvurular için bağlantı yenilenebilir");
  }
  return prisma.application.findUniqueOrThrow({ where: { id } });
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

// Confirm a manual Havale/EFT bank transfer for an APPROVED application. Unlike
// markPaidByToken there is NO token-expiry gate: the organizer verifies the
// transfer in their own bank and is the authority, possibly after the pay
// link's TTL has lapsed. Marks PAID, stamps paymentRef "havale", and issues the
// QR tickets in the same transaction. The guarded updateMany (status APPROVED,
// paidAt null) makes a repeat confirm a no-op (throws) rather than a double issue.
export async function markPaidByHavale(id: string, now: Date = new Date()) {
  return prisma.$transaction(async (tx) => {
    const app = await tx.application.findUniqueOrThrow({ where: { id } });
    const amount = app.ticketQuantity * config.ticketPrice;
    const result = await tx.application.updateMany({
      where: { id, status: "APPROVED", paidAt: null },
      data: { status: "PAID", paymentRef: "havale", amount, paidAt: now },
    });
    if (result.count === 0) throw new NotPayableError();
    const updated = await tx.application.findUniqueOrThrow({ where: { id } });
    await issueTickets(tx, updated);
    return tx.application.findUniqueOrThrow({
      where: { id },
      include: { tickets: true },
    });
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

// Revert a mistaken Havale confirmation back to APPROVED. Gated on the "havale"
// marker so online (iyzico/stub) and door-pos payments stay untouched. Resets
// any tickets checked in after confirmation to VALID and keeps the issued
// tickets, so the booking returns to a has-pass-but-unpaid state (mirrors
// undoDoorPayment).
export async function undoHavalePayment(id: string) {
  return prisma.$transaction(async (tx) => {
    const app = await tx.application.findUniqueOrThrow({ where: { id } });
    if (app.status !== "PAID" || app.paymentRef !== "havale") {
      throw new NotPayableError();
    }
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

// Cap on rows returned by the door type-ahead searches. Plenty for narrowing by
// name at the gate, and it stops an empty query from loading the whole table
// once there are thousands of applications.
const SEARCH_LIMIT = 100;

// Name-search over APPROVED (unpaid) applications, sorted by name. Shared by the
// desktop door screen and the mobile door screen. An empty query returns the
// first SEARCH_LIMIT rows.
export async function searchApprovedApplications(query: string, limit = SEARCH_LIMIT) {
  const q = query.trim();
  return prisma.application.findMany({
    where: {
      status: "APPROVED",
      ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}),
    },
    orderBy: { name: "asc" },
    take: limit,
  });
}

// Name-search over applications that already hold a QR pass (ticketsAccessToken
// set) — PAID guests and APPROVED "pay at the door" guests alike — with their
// tickets included for the mobile Guests screen's manual check-in.
export async function searchAttendeeApplications(query: string, limit = SEARCH_LIMIT) {
  const q = query.trim();
  return prisma.application.findMany({
    where: {
      ticketsAccessToken: { not: null },
      ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}),
    },
    orderBy: { name: "asc" },
    include: { tickets: { orderBy: { createdAt: "asc" } } },
    take: limit,
  });
}

// Returns the paid application (with tickets) only when its post-payment
// notification still needs sending — i.e. it is PAID but ticketsDeliveredAt was
// never stamped (a crash happened between marking paid and dispatching). The
// callback uses this to redeliver on a webhook retry without re-sending to
// guests who already got their tickets. Returns null otherwise.
export async function loadUndeliveredPaid(payToken: string) {
  const app = await prisma.application.findUnique({
    where: { payToken },
    include: { tickets: true },
  });
  if (!app || app.status !== "PAID" || app.ticketsDeliveredAt) return null;
  return app;
}

// Stamp that the tickets notification has been dispatched, so future webhook
// retries don't resend it.
export async function stampTicketsDelivered(id: string) {
  await prisma.application.update({
    where: { id },
    data: { ticketsDeliveredAt: new Date() },
  });
}

// Issue an unpaid "pay at the gate" QR pass for an APPROVED booking. Unlike
// markPaidByHavale this records NO payment: it issues the QR tickets (via the
// idempotent issueTickets) and leaves the application APPROVED / unpaid. The
// gate collects payment on scan (collectAtDoorAndCheckIn). A repeat tap is a
// no-op because issueTickets returns the existing tickets once ticketsAccessToken
// is set.
export async function issueGatePass(id: string) {
  return prisma.$transaction(async (tx) => {
    const app = await tx.application.findUniqueOrThrow({ where: { id } });
    if (app.status !== "APPROVED") {
      throw new TransitionError(
        "Yalnızca onaylanmış başvurulara kapıda öde bileti verilebilir",
      );
    }
    await issueTickets(tx, app);
    return tx.application.findUniqueOrThrow({
      where: { id },
      include: { tickets: true },
    });
  });
}

// Revoke a mistakenly-issued gate pass: delete the QR tickets and clear the
// access token, returning the booking to APPROVED / no-pass. Refuses once the
// booking is paid, or once any ticket is USED (the guest has already checked in),
// so it can never undo a payment or strand an attendee.
export async function revokeGatePass(id: string) {
  return prisma.$transaction(async (tx) => {
    const app = await tx.application.findUniqueOrThrow({ where: { id } });
    if (app.status !== "APPROVED" || app.paidAt) throw new NotPayableError();
    const used = await tx.ticket.count({
      where: { applicationId: id, status: "USED" },
    });
    if (used > 0) throw new NotPayableError();
    await tx.ticket.deleteMany({ where: { applicationId: id } });
    await tx.application.update({
      where: { id },
      data: { ticketsAccessToken: null, ticketsDeliveredAt: null },
    });
    return tx.application.findUniqueOrThrow({ where: { id } });
  });
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
