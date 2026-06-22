import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDb } from "@/test/helpers";
import { config } from "@/lib/config";
import {
  createApplication,
  approveApplication,
  markPaidByToken,
  collectAtDoorAndCheckIn,
} from "./applications";
import { issueTickets, checkInTicket } from "./tickets";
import { gateStats } from "./stats";

let dbReady = false;
try {
  await prisma.$queryRaw`SELECT 1`;
  dbReady = true;
} catch {
  dbReady = false;
}
const suite = dbReady ? describe : describe.skip;

afterAll(async () => {
  await prisma.$disconnect().catch(() => {});
});
beforeEach(async () => {
  if (dbReady) await resetDb();
});

const input = {
  name: "Ali",
  email: "ali@example.com",
  socialTags: "@ali",
  ticketQuantity: 2,
  guestNames: ["Ayse"], // -> 2 tickets per app (buyer + 1 guest)
  guestSocials: ["@ayse"],
  childCount: 0,
};

// A fully PAID application (online), tickets issued.
async function paidApp(name: string) {
  const a = await createApplication({ ...input, name });
  const approved = await approveApplication(a.id);
  await markPaidByToken(approved.payToken!, "stub_ref", input.ticketQuantity * config.ticketPrice);
  return prisma.application.findUniqueOrThrow({ where: { id: a.id }, include: { tickets: true } });
}

// An APPROVED "pay at the door" application with a pass issued (still unpaid).
async function doorPassApp(name: string) {
  const a = await createApplication({ ...input, name });
  const approved = await approveApplication(a.id);
  const tickets = await issueTickets(prisma, approved); // status stays APPROVED
  return { id: a.id, tickets };
}

suite("gateStats", () => {
  it("counts paid tickets, check-ins, and remaining", async () => {
    const paid = await paidApp("Paid Pat"); // 2 paid tickets
    await checkInTicket(paid.tickets[0].verifyToken); // 1 in

    const s = await gateStats();
    expect(s.paidTickets).toBe(2);
    expect(s.checkedIn).toBe(1);
    expect(s.remaining).toBe(1);
  });

  it("counts outstanding door passes separately and not as paid", async () => {
    await doorPassApp("Door Dora"); // 2 unpaid pass tickets, APPROVED

    const s = await gateStats();
    expect(s.outstandingDoorPasses).toBe(2);
    expect(s.paidTickets).toBe(0); // unpaid passes are NOT paid
  });

  it("counts door-pos collections (count + summed amount)", async () => {
    const { id, tickets } = await doorPassApp("Collect Cem");
    await collectAtDoorAndCheckIn(id, tickets[0].verifyToken); // -> PAID door-pos, 1 in

    const s = await gateStats();
    expect(s.doorCollections.count).toBe(1);
    expect(s.doorCollections.amount).toBe(input.ticketQuantity * config.ticketPrice);
    expect(s.paidTickets).toBe(2); // now paid
    expect(s.checkedIn).toBe(1);
    expect(s.outstandingDoorPasses).toBe(0); // no longer APPROVED
  });

  it("returns all-zero on an empty DB", async () => {
    const s = await gateStats();
    expect(s).toEqual({
      checkedIn: 0,
      paidTickets: 0,
      remaining: 0,
      outstandingDoorPasses: 0,
      doorCollections: { count: 0, amount: 0 },
    });
  });
});
