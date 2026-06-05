import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDb } from "@/test/helpers";
import {
  createApplication,
  approveApplication,
  rejectApplication,
  markPaidByToken,
} from "./applications";

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
};

suite("application use-cases", () => {
  it("creates a PENDING application", async () => {
    const a = await createApplication(input);
    expect(a.status).toBe("PENDING");
    expect(JSON.parse(a.guestNames)).toEqual(["Ayse"]);
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
