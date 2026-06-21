import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDb } from "@/test/helpers";
import { createApplication, approveApplication, markPaidByToken, NotPayableError } from "./applications";
import { attendeesFor, issueTickets, loadTicketsByAccessToken, checkInTicket, scanTicket } from "./tickets";

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

async function payNewApplication() {
  const app = await createApplication(input);
  const approved = await approveApplication(app.id);
  await markPaidByToken(approved.payToken!, "ref-1", 3 * 500);
  return prisma.application.findUniqueOrThrow({
    where: { id: app.id },
    include: { tickets: true },
  });
}

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

suite("loadTicketsByAccessToken", () => {
  const before = new Date("2026-01-01T00:00:00.000Z");
  const after = new Date("2027-01-01T00:00:00.000Z");
  const eventEnd = new Date("2026-09-01T21:00:00.000Z");

  it("returns a valid view with tickets before the event ends", async () => {
    const paid = await payNewApplication();
    const view = await loadTicketsByAccessToken(paid.ticketsAccessToken!, before, eventEnd);
    expect(view.kind).toBe("valid");
    if (view.kind === "valid") {
      expect(view.application.name).toBe(paid.name);
      expect(view.tickets.length).toBe(paid.tickets.length);
    }
  });

  it("returns expired after the event end", async () => {
    const paid = await payNewApplication();
    const view = await loadTicketsByAccessToken(paid.ticketsAccessToken!, after, eventEnd);
    expect(view.kind).toBe("expired");
  });

  it("returns notfound for an unknown token", async () => {
    const view = await loadTicketsByAccessToken("nope-not-a-token", before, eventEnd);
    expect(view.kind).toBe("notfound");
  });
});

suite("checkInTicket", () => {
  it("checks in a VALID ticket by verifyToken -> valid, flips to USED, stamps checkedInAt", async () => {
    const paid = await payNewApplication();
    const ticket = paid.tickets[0];
    const at = new Date("2026-09-01T18:00:00.000Z");

    const res = await checkInTicket(ticket.verifyToken, at);

    expect(res.result).toBe("valid");
    if (res.result === "valid") {
      expect(res.holderName).toBe(ticket.holderName);
      expect(res.code).toBe(ticket.code);
      expect(res.checkedInAt.toISOString()).toBe(at.toISOString());
    }
    const row = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(row.status).toBe("USED");
    expect(row.checkedInAt?.toISOString()).toBe(at.toISOString());
  });

  it("checks in by human code as well as verifyToken", async () => {
    const paid = await payNewApplication();
    const ticket = paid.tickets[1];
    const res = await checkInTicket(ticket.code);
    expect(res.result).toBe("valid");
  });

  it("a second scan returns used and keeps the ORIGINAL checkedInAt", async () => {
    const paid = await payNewApplication();
    const ticket = paid.tickets[0];
    const first = new Date("2026-09-01T18:00:00.000Z");
    const later = new Date("2026-09-01T19:30:00.000Z");

    await checkInTicket(ticket.verifyToken, first);
    const res = await checkInTicket(ticket.verifyToken, later);

    expect(res.result).toBe("used");
    if (res.result === "used") {
      expect(res.holderName).toBe(ticket.holderName);
      expect(res.checkedInAt.toISOString()).toBe(first.toISOString()); // not overwritten
    }
  });

  it("returns invalid for an unknown identifier", async () => {
    const res = await checkInTicket("not-a-real-token");
    expect(res.result).toBe("invalid");
  });

  it("two concurrent check-ins of the same ticket -> exactly one valid, one used", async () => {
    const paid = await payNewApplication();
    const ticket = paid.tickets[0];

    const [a, b] = await Promise.all([
      checkInTicket(ticket.verifyToken),
      checkInTicket(ticket.verifyToken),
    ]);

    const results = [a.result, b.result].sort();
    expect(results).toEqual(["used", "valid"]);
    const row = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(row.status).toBe("USED");
  });
});

async function doorPassApplication() {
  const app = await createApplication(input);
  const approved = await approveApplication(app.id);
  // Issue tickets while leaving status APPROVED (the "Kapıda öde" state).
  const tickets = await issueTickets(prisma, approved);
  const reloaded = await prisma.application.findUniqueOrThrow({
    where: { id: app.id },
    include: { tickets: true },
  });
  return { application: reloaded, tickets };
}

suite("scanTicket", () => {
  it("returns unpaid for an APPROVED application that has a QR pass", async () => {
    const { application, tickets } = await doorPassApplication();
    const res = await scanTicket(tickets[0].verifyToken);
    expect(res.result).toBe("unpaid");
    if (res.result === "unpaid") {
      expect(res.applicationId).toBe(application.id);
      expect(res.quantity).toBe(input.ticketQuantity); // 3
      expect(res.amount).toBe(input.ticketQuantity * 500); // ticketPrice in test env = 500
      expect(res.holderName).toBe(tickets[0].holderName);
    }
    // Crucially, an unpaid scan must NOT check the ticket in.
    const row = await prisma.ticket.findUniqueOrThrow({ where: { id: tickets[0].id } });
    expect(row.status).toBe("VALID");
  });

  it("checks in a VALID ticket of a PAID application (valid)", async () => {
    const paid = await payNewApplication();
    const res = await scanTicket(paid.tickets[0].verifyToken);
    expect(res.result).toBe("valid");
  });

  it("returns used on the second scan of a PAID ticket", async () => {
    const paid = await payNewApplication();
    await scanTicket(paid.tickets[0].verifyToken);
    const res = await scanTicket(paid.tickets[0].verifyToken);
    expect(res.result).toBe("used");
  });

  it("returns invalid for an unknown identifier", async () => {
    const res = await scanTicket("not-a-real-token");
    expect(res.result).toBe("invalid");
  });
});
