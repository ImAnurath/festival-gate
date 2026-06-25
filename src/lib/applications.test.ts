import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDb } from "@/test/helpers";
import { config } from "@/lib/config";
import {
  createApplication,
  approveApplication,
  rejectApplication,
  reissuePayLink,
  loadUndeliveredPaid,
  stampTicketsDelivered,
  markPaidByToken,
  markPaidAtDoor,
  undoDoorPayment,
  markPaidByHavale,
  undoHavalePayment,
  collectAtDoorAndCheckIn,
  searchApprovedApplications,
  searchAttendeeApplications,
  issueGatePass,
  revokeGatePass,
  requestPayInPerson,
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

  it("approve refuses an application that is no longer PENDING", async () => {
    const a = await createApplication(input);
    await approveApplication(a.id);
    await expect(approveApplication(a.id)).rejects.toThrow(); // already APPROVED
  });

  it("reject refuses a PAID application", async () => {
    const a = await createApplication(input);
    const approved = await approveApplication(a.id);
    await markPaidByToken(approved.payToken!, "stub_ref", 1000);
    await expect(rejectApplication(a.id)).rejects.toThrow();
  });

  it("reissuePayLink refuses a non-APPROVED application", async () => {
    const a = await createApplication(input); // still PENDING
    await expect(reissuePayLink(a.id)).rejects.toThrow();
  });

  // The point of making approve atomic: two admins clicking at once must not
  // both succeed, and the row must end in a single consistent APPROVED state.
  it("concurrent approves: exactly one wins, status stays APPROVED", async () => {
    const a = await createApplication(input);
    const results = await Promise.allSettled([
      approveApplication(a.id),
      approveApplication(a.id),
    ]);
    const won = results.filter((r) => r.status === "fulfilled");
    expect(won.length).toBe(1);
    const app = await prisma.application.findUniqueOrThrow({ where: { id: a.id } });
    expect(app.status).toBe("APPROVED");
  });

  // Approve racing reject: whichever guard matches first wins; the loser throws.
  // The row must never end in an inconsistent or PENDING state.
  it("concurrent approve vs reject: one wins, state is terminal", async () => {
    const a = await createApplication(input);
    const [approveRes, rejectRes] = await Promise.allSettled([
      approveApplication(a.id),
      rejectApplication(a.id),
    ]);
    const winners = [approveRes, rejectRes].filter((r) => r.status === "fulfilled");
    expect(winners.length).toBeGreaterThanOrEqual(1);
    const app = await prisma.application.findUniqueOrThrow({ where: { id: a.id } });
    expect(["APPROVED", "REJECTED"]).toContain(app.status);
  });

  it("loadUndeliveredPaid returns a paid-but-undelivered app, then null once stamped", async () => {
    const a = await createApplication(input);
    const approved = await approveApplication(a.id);

    // Not paid yet -> nothing to deliver.
    expect(await loadUndeliveredPaid(approved.payToken!)).toBeNull();

    await markPaidByToken(approved.payToken!, "stub_ref", 1000);
    const pending = await loadUndeliveredPaid(approved.payToken!);
    expect(pending).not.toBeNull();
    expect(pending!.tickets.length).toBeGreaterThan(0); // includes tickets for delivery

    // After stamping, a webhook retry finds nothing to resend.
    await stampTicketsDelivered(pending!.id);
    expect(await loadUndeliveredPaid(approved.payToken!)).toBeNull();
  });

  it("searchApprovedApplications caps the number of rows returned", async () => {
    for (let i = 0; i < 3; i++) {
      const a = await createApplication({ ...input, name: `Search ${i}` });
      await approveApplication(a.id);
    }
    const limited = await searchApprovedApplications("Search", 2);
    expect(limited.length).toBe(2);
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

suite("havale payments", () => {
  it("markPaidByHavale marks PAID, stamps havale ref, and issues tickets", async () => {
    const a = await createApplication(input);
    const approved = await approveApplication(a.id);
    const paid = await markPaidByHavale(approved.id);

    expect(paid.status).toBe("PAID");
    expect(paid.paymentRef).toBe("havale");
    expect(paid.amount).toBe(input.ticketQuantity * config.ticketPrice);
    expect(paid.paidAt).toBeInstanceOf(Date);
    expect(paid.ticketsAccessToken).toBeTruthy();
    expect(paid.tickets.length).toBe(2); // buyer + 1 guest
  });

  it("markPaidByHavale refuses a non-APPROVED application", async () => {
    const a = await createApplication(input); // still PENDING
    await expect(markPaidByHavale(a.id)).rejects.toThrow();
  });

  it("markPaidByHavale is idempotent-safe: a second confirm throws", async () => {
    const a = await createApplication(input);
    const approved = await approveApplication(a.id);
    await markPaidByHavale(approved.id);
    await expect(markPaidByHavale(approved.id)).rejects.toThrow();
  });

  it("markPaidByHavale succeeds even when the pay token has expired", async () => {
    const a = await createApplication(input);
    const approved = await approveApplication(a.id);
    await prisma.application.update({
      where: { id: approved.id },
      data: { payTokenExpiresAt: new Date(Date.now() - 1000) },
    });
    const paid = await markPaidByHavale(approved.id);
    expect(paid.status).toBe("PAID");
  });

  it("undoHavalePayment reverts a havale payment and resets USED tickets", async () => {
    const a = await createApplication(input);
    const approved = await approveApplication(a.id);
    const paid = await markPaidByHavale(approved.id);
    // Simulate one ticket checked in at the gate after confirmation.
    await prisma.ticket.update({
      where: { id: paid.tickets[0].id },
      data: { status: "USED", checkedInAt: new Date() },
    });

    const reverted = await undoHavalePayment(approved.id);
    expect(reverted.status).toBe("APPROVED");
    expect(reverted.paidAt).toBeNull();
    expect(reverted.amount).toBeNull();
    expect(reverted.paymentRef).toBeNull();

    const t0 = await prisma.ticket.findUniqueOrThrow({ where: { id: paid.tickets[0].id } });
    expect(t0.status).toBe("VALID");
    expect(t0.checkedInAt).toBeNull();
  });

  it("undoHavalePayment refuses an online (iyzico/stub) payment", async () => {
    const a = await createApplication(input);
    const approved = await approveApplication(a.id);
    await markPaidByToken(approved.payToken!, "stub_ref", 1000);
    await expect(undoHavalePayment(approved.id)).rejects.toThrow();

    const still = await prisma.application.findUniqueOrThrow({ where: { id: approved.id } });
    expect(still.status).toBe("PAID");
    expect(still.paymentRef).toBe("stub_ref");
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

suite("search helpers", () => {
  it("searchApprovedApplications returns only APPROVED, name-filtered, sorted", async () => {
    const a = await createApplication({ ...input, name: "Zeynep" });
    await approveApplication(a.id);
    const b = await createApplication({ ...input, name: "Ahmet" });
    await approveApplication(b.id);
    await createApplication({ ...input, name: "Pending Pelin" }); // stays PENDING

    const all = await searchApprovedApplications("");
    expect(all.map((x) => x.name)).toEqual(["Ahmet", "Zeynep"]); // sorted, PENDING excluded

    const filtered = await searchApprovedApplications("zey");
    expect(filtered.map((x) => x.name)).toEqual(["Zeynep"]); // case-insensitive
  });

  it("searchAttendeeApplications returns only apps with issued tickets, including tickets", async () => {
    // Door-pass: APPROVED with tickets issued.
    const a = await createApplication({ ...input, name: "Mert" });
    const approved = await approveApplication(a.id);
    await issueTickets(prisma, approved);
    // APPROVED without tickets must be excluded.
    const b = await createApplication({ ...input, name: "Mehmet" });
    await approveApplication(b.id);

    const res = await searchAttendeeApplications("me");
    expect(res.map((x) => x.name)).toEqual(["Mert"]); // Mehmet has no tickets
    expect(res[0].tickets.length).toBe(2); // buyer + 1 guest
    expect(res[0].tickets[0].verifyToken).toBeTruthy();
    expect(res[0].tickets[0].isBuyer).toBe(true);
    expect(res[0].tickets[0].holderName).toBe("Mert");
  });
});

suite("gate pass (pay at the gate)", () => {
  it("issueGatePass issues an unpaid QR and leaves the booking APPROVED", async () => {
    const a = await createApplication(input);
    const approved = await approveApplication(a.id);
    const pass = await issueGatePass(approved.id);

    expect(pass.status).toBe("APPROVED");
    expect(pass.paidAt).toBeNull();
    expect(pass.paymentRef).toBeNull();
    expect(pass.ticketsAccessToken).toBeTruthy();
    expect(pass.tickets.length).toBe(2); // buyer + 1 guest
  });

  it("issueGatePass is idempotent: a second call issues no extra tickets", async () => {
    const a = await createApplication(input);
    const approved = await approveApplication(a.id);
    const first = await issueGatePass(approved.id);
    const second = await issueGatePass(approved.id);

    expect(second.tickets.length).toBe(first.tickets.length);
    expect(second.ticketsAccessToken).toBe(first.ticketsAccessToken);
    const count = await prisma.ticket.count({ where: { applicationId: approved.id } });
    expect(count).toBe(2);
  });

  it("issueGatePass refuses a non-APPROVED application", async () => {
    const a = await createApplication(input); // still PENDING
    await expect(issueGatePass(a.id)).rejects.toThrow();
  });

  it("revokeGatePass deletes the tickets and clears the access token", async () => {
    const a = await createApplication(input);
    const approved = await approveApplication(a.id);
    await issueGatePass(approved.id);

    const reverted = await revokeGatePass(approved.id);
    expect(reverted.status).toBe("APPROVED");
    expect(reverted.ticketsAccessToken).toBeNull();

    const count = await prisma.ticket.count({ where: { applicationId: approved.id } });
    expect(count).toBe(0);
  });

  it("revokeGatePass refuses once a ticket has been USED", async () => {
    const a = await createApplication(input);
    const approved = await approveApplication(a.id);
    const pass = await issueGatePass(approved.id);
    await prisma.ticket.update({
      where: { id: pass.tickets[0].id },
      data: { status: "USED", checkedInAt: new Date() },
    });

    await expect(revokeGatePass(approved.id)).rejects.toThrow();
    const count = await prisma.ticket.count({ where: { applicationId: approved.id } });
    expect(count).toBe(2); // nothing deleted
  });

  it("revokeGatePass refuses a PAID booking", async () => {
    const a = await createApplication(input);
    const approved = await approveApplication(a.id);
    await markPaidByHavale(approved.id); // PAID + tickets issued
    await expect(revokeGatePass(approved.id)).rejects.toThrow();

    const still = await prisma.application.findUniqueOrThrow({ where: { id: approved.id } });
    expect(still.status).toBe("PAID");
  });
});

suite("requestPayInPerson", () => {
  it("stamps payInPersonRequestedAt on an APPROVED booking", async () => {
    const a = await createApplication(input);
    const approved = await approveApplication(a.id);
    await requestPayInPerson(approved.payToken!);

    const after = await prisma.application.findUniqueOrThrow({ where: { id: approved.id } });
    expect(after.payInPersonRequestedAt).toBeInstanceOf(Date);
    expect(after.status).toBe("APPROVED"); // unchanged
  });

  it("is idempotent: a second call keeps the first timestamp", async () => {
    const a = await createApplication(input);
    const approved = await approveApplication(a.id);
    await requestPayInPerson(approved.payToken!);
    const first = await prisma.application.findUniqueOrThrow({ where: { id: approved.id } });
    await requestPayInPerson(approved.payToken!);
    const second = await prisma.application.findUniqueOrThrow({ where: { id: approved.id } });

    expect(second.payInPersonRequestedAt).toEqual(first.payInPersonRequestedAt);
  });

  it("is a silent no-op on a non-APPROVED booking", async () => {
    const a = await createApplication(input); // still PENDING, but has no payToken
    await expect(requestPayInPerson("nonexistent-token")).resolves.toBeUndefined();
    const after = await prisma.application.findUniqueOrThrow({ where: { id: a.id } });
    expect(after.payInPersonRequestedAt).toBeNull();
  });
});
