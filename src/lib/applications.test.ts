import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDb } from "@/test/helpers";
import { config } from "@/lib/config";
import {
  createApplication,
  approveApplication,
  rejectApplication,
  markPaidByToken,
  markPaidAtDoor,
  undoDoorPayment,
  collectAtDoorAndCheckIn,
} from "./applications";
import { issueTickets } from "./tickets";

// These use-case tests need a real Postgres database. If none is reachable
// (e.g. no local Postgres yet), skip them so the pure-logic suites still pass.
// Point DATABASE_URL_TEST at your DB to run them.
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
  guestNames: ["Ayse"],
  guestSocials: ["@ayse"],
  childCount: 2,
};

suite("application use-cases", () => {
  it("creates a PENDING application", async () => {
    const a = await createApplication(input);
    expect(a.status).toBe("PENDING");
    expect(JSON.parse(a.guestNames)).toEqual(["Ayse"]);
    expect(JSON.parse(a.guestSocials)).toEqual(["@ayse"]);
    expect(a.childCount).toBe(2);
  });

  it("approve assigns a token and expiry", async () => {
    const a = await createApplication(input);
    const approved = await approveApplication(a.id);
    expect(approved.status).toBe("APPROVED");
    expect(approved.payToken).toBeTruthy();
    expect(approved.payTokenExpiresAt).toBeInstanceOf(Date);
  });

  it("markPaidByToken sets PAID, amount and paymentRef", async () => {
    const a = await createApplication(input);
    const approved = await approveApplication(a.id);
    const paid = await markPaidByToken(approved.payToken!, "stub_ref", 1000);
    expect(paid.status).toBe("PAID");
    expect(paid.amount).toBe(1000);
    expect(paid.paymentRef).toBe("stub_ref");
    expect(paid.paidAt).toBeInstanceOf(Date);
  });

  it("markPaidByToken refuses a second payment", async () => {
    const a = await createApplication(input);
    const approved = await approveApplication(a.id);
    await markPaidByToken(approved.payToken!, "stub_ref", 1000);
    await expect(markPaidByToken(approved.payToken!, "x", 1000)).rejects.toThrow();
  });

  it("markPaidByToken refuses an unknown token", async () => {
    await expect(markPaidByToken("nope", "x", 1000)).rejects.toThrow();
  });

  it("markPaidByToken refuses payment after token expiry", async () => {
    const a = await createApplication(input);
    const approved = await approveApplication(a.id);
    // Force the token to be expired
    await prisma.application.update({
      where: { id: approved.id },
      data: { payTokenExpiresAt: new Date(Date.now() - 1000) },
    });
    await expect(markPaidByToken(approved.payToken!, "x", 1000)).rejects.toThrow();
  });

  it("reject moves to REJECTED", async () => {
    const a = await createApplication(input);
    const r = await rejectApplication(a.id);
    expect(r.status).toBe("REJECTED");
  });
});

suite("door payments", () => {
  it("markPaidAtDoor marks an APPROVED application PAID with no tickets", async () => {
    const a = await createApplication(input);
    const approved = await approveApplication(a.id);
    const paid = await markPaidAtDoor(approved.id);

    expect(paid.status).toBe("PAID");
    expect(paid.paymentRef).toBe("door-pos");
    expect(paid.amount).toBe(input.ticketQuantity * config.ticketPrice);
    expect(paid.paidAt).toBeInstanceOf(Date);

    const tickets = await prisma.ticket.findMany({ where: { applicationId: a.id } });
    expect(tickets).toHaveLength(0);
  });

  it("markPaidAtDoor refuses a second mark (already paid)", async () => {
    const a = await createApplication(input);
    const approved = await approveApplication(a.id);
    await markPaidAtDoor(approved.id);
    await expect(markPaidAtDoor(approved.id)).rejects.toThrow();
  });

  it("markPaidAtDoor refuses a non-APPROVED application", async () => {
    const a = await createApplication(input); // still PENDING
    await expect(markPaidAtDoor(a.id)).rejects.toThrow();
  });

  it("undoDoorPayment reverts a door-paid application to APPROVED", async () => {
    const a = await createApplication(input);
    const approved = await approveApplication(a.id);
    await markPaidAtDoor(approved.id);
    const reverted = await undoDoorPayment(approved.id);

    expect(reverted.status).toBe("APPROVED");
    expect(reverted.paidAt).toBeNull();
    expect(reverted.amount).toBeNull();
    expect(reverted.paymentRef).toBeNull();
  });

  it("undoDoorPayment refuses an online-paid application with tickets", async () => {
    const a = await createApplication(input);
    const approved = await approveApplication(a.id);
    await markPaidByToken(approved.payToken!, "stub_ref", 1000); // issues tickets
    await expect(undoDoorPayment(approved.id)).rejects.toThrow();

    const still = await prisma.application.findUniqueOrThrow({ where: { id: approved.id } });
    expect(still.status).toBe("PAID");
    expect(still.paymentRef).toBe("stub_ref");
  });

  it("undoDoorPayment reverts a door-pass payment and resets its checked-in tickets", async () => {
    const a = await createApplication(input);
    const approved = await approveApplication(a.id);
    const tickets = await issueTickets(prisma, approved); // door pass, status APPROVED
    await collectAtDoorAndCheckIn(approved.id, tickets[0].verifyToken); // PAID + ticket USED

    const reverted = await undoDoorPayment(approved.id);
    expect(reverted.status).toBe("APPROVED");
    expect(reverted.paymentRef).toBeNull();

    const t0 = await prisma.ticket.findUniqueOrThrow({ where: { id: tickets[0].id } });
    expect(t0.status).toBe("VALID"); // reset
    expect(t0.checkedInAt).toBeNull();
  });
});

suite("collectAtDoorAndCheckIn", () => {
  async function doorPass() {
    const app = await createApplication(input); // ticketQuantity 2, 1 guest -> 2 tickets
    const approved = await approveApplication(app.id);
    const tickets = await issueTickets(prisma, approved); // status stays APPROVED
    return { id: app.id, tickets };
  }

  it("marks the whole application PAID (door-pos) and checks in the scanned ticket", async () => {
    const { id, tickets } = await doorPass();
    const res = await collectAtDoorAndCheckIn(id, tickets[0].verifyToken);

    expect(res.result).toBe("valid");

    const app = await prisma.application.findUniqueOrThrow({ where: { id } });
    expect(app.status).toBe("PAID");
    expect(app.paymentRef).toBe("door-pos");
    expect(app.amount).toBe(input.ticketQuantity * config.ticketPrice);

    const scanned = await prisma.ticket.findUniqueOrThrow({ where: { id: tickets[0].id } });
    expect(scanned.status).toBe("USED");
  });

  it("leaves the rest of the group VALID so they scan straight through", async () => {
    const { id, tickets } = await doorPass();
    await collectAtDoorAndCheckIn(id, tickets[0].verifyToken);

    const other = await prisma.ticket.findUniqueOrThrow({ where: { id: tickets[1].id } });
    expect(other.status).toBe("VALID"); // not checked in by the group payment
  });

  it("is safe when the application is already paid (just checks in)", async () => {
    const { id, tickets } = await doorPass();
    await markPaidAtDoor(id); // pay first via the name-search screen
    const res = await collectAtDoorAndCheckIn(id, tickets[0].verifyToken);
    expect(res.result).toBe("valid");
    const scanned = await prisma.ticket.findUniqueOrThrow({ where: { id: tickets[0].id } });
    expect(scanned.status).toBe("USED");
  });
});
