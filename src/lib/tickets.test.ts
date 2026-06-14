import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDb } from "@/test/helpers";
import { createApplication, approveApplication, markPaidByToken, NotPayableError } from "./applications";
import { attendeesFor, issueTickets } from "./tickets";

// DB-backed; skip when no Postgres is reachable (same pattern as applications.test.ts).
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
  name: "Ali Veli",
  email: "ali@example.com",
  socialTags: "@ali",
  ticketQuantity: 3,
  guestNames: ["Ayşe Yılmaz", "Mehmet Demir"],
  guestSocials: ["@ayse", "@mehmet"],
  childCount: 2,
};

describe("attendeesFor", () => {
  it("lists the buyer first, then each guest; children are excluded", () => {
    const attendees = attendeesFor({
      name: "Ali Veli",
      guestNames: JSON.stringify(["Ayşe Yılmaz", "Mehmet Demir"]),
    });
    expect(attendees).toEqual([
      { holderName: "Ali Veli", isBuyer: true },
      { holderName: "Ayşe Yılmaz", isBuyer: false },
      { holderName: "Mehmet Demir", isBuyer: false },
    ]);
  });
});

suite("issueTickets", () => {
  it("creates one VALID ticket per attendee with unique token + code", async () => {
    const app = await createApplication(input);
    const tickets = await issueTickets(prisma, app);

    expect(tickets).toHaveLength(3); // 1 buyer + 2 guests; childCount ignored
    expect(tickets.map((t) => t.holderName)).toEqual([
      "Ali Veli",
      "Ayşe Yılmaz",
      "Mehmet Demir",
    ]);
    expect(tickets.filter((t) => t.isBuyer)).toHaveLength(1);
    expect(tickets.every((t) => t.status === "VALID")).toBe(true);
    expect(tickets.every((t) => t.checkedInAt === null)).toBe(true);

    const codes = new Set(tickets.map((t) => t.code));
    const tokens = new Set(tickets.map((t) => t.verifyToken));
    expect(codes.size).toBe(3);
    expect(tokens.size).toBe(3);
    expect(tickets.every((t) => /^KF-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{5}$/.test(t.code))).toBe(true);
  });

  it("sets ticketsAccessToken on the application", async () => {
    const app = await createApplication(input);
    await issueTickets(prisma, app);
    const reloaded = await prisma.application.findUniqueOrThrow({ where: { id: app.id } });
    expect(reloaded.ticketsAccessToken).toBeTruthy();
  });

  it("is idempotent: a second call creates no duplicates", async () => {
    const app = await createApplication(input);
    await issueTickets(prisma, app);
    const reloaded = await prisma.application.findUniqueOrThrow({ where: { id: app.id } });
    const second = await issueTickets(prisma, reloaded);
    expect(second).toHaveLength(3);
    expect(await prisma.ticket.count({ where: { applicationId: app.id } })).toBe(3);
  });
});

suite("markPaidByToken issues tickets", () => {
  async function payNewApplication() {
    const app = await createApplication(input);
    const approved = await approveApplication(app.id);
    await markPaidByToken(approved.payToken!, "ref-1", 3 * 500);
    return prisma.application.findUniqueOrThrow({
      where: { id: app.id },
      include: { tickets: true },
    });
  }

  it("creates tickets when an application is paid", async () => {
    const paid = await payNewApplication();
    expect(paid.status).toBe("PAID");
    expect(paid.ticketsAccessToken).toBeTruthy();
    expect(paid.tickets).toHaveLength(3);
    expect(paid.tickets.map((t) => t.holderName)).toContain("Ali Veli");
  });

  it("does not duplicate tickets when the payment callback is replayed", async () => {
    const paid = await payNewApplication();
    const token = (await prisma.application.findUniqueOrThrow({ where: { id: paid.id } })).payToken!;
    // Second call hits the already-PAID guard and throws (idempotent no-op upstream).
    await expect(markPaidByToken(token, "ref-2", 3 * 500)).rejects.toThrow(NotPayableError);
    expect(await prisma.ticket.count({ where: { applicationId: paid.id } })).toBe(3);
  });

  it("leaves an unpaid application with no tickets", async () => {
    const app = await createApplication(input);
    await approveApplication(app.id);
    expect(await prisma.ticket.count({ where: { applicationId: app.id } })).toBe(0);
  });

  it("markPaidByToken returns the application with its tickets and access token", async () => {
    const app = await createApplication(input);
    const approved = await approveApplication(app.id);
    const paid = await markPaidByToken(approved.payToken!, "ref_123", 3 * 500);
    // The returned object itself (no extra reload) must be delivery-ready.
    expect(paid.ticketsAccessToken).toBeTruthy();
    expect(paid.tickets).toHaveLength(1 + input.guestNames.length); // 1 buyer + 2 guests = 3
  });
});
