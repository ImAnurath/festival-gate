# Pay-at-Door QR Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an approved applicant get a QR pass before paying ("Kapıda öde"), and have the door scanner collect payment for the whole group on an unpaid scan, then check the scanned ticket in.

**Architecture:** Reuse `Application.status` as the source of truth — issue tickets while the application stays `APPROVED` (unpaid). The scanner gains an `unpaid` branch that shows "collect X TL" instead of checking in; a confirm endpoint marks the whole application paid at the door (`door-pos`) and checks in the scanned ticket. No schema change, no migration.

**Tech Stack:** Next.js 16 (App Router, server components + route handlers), Prisma 7 + Postgres, Vitest 4, Tailwind 4, `html5-qrcode` scanner, TypeScript 5.

## Global Constraints

- **No schema/migration change.** Payment state stays on `Application.status` (`PENDING → APPROVED → PAID`, or `REJECTED`).
- **Door payments are tagged `paymentRef === "door-pos"`** — this marker (not ticket count) distinguishes door from online payments.
- **Invariant change:** tickets may now exist for an `APPROVED` (unpaid) application. Do not reintroduce any "tickets ⇒ paid" assumption.
- **UI copy is Turkish**, matching existing pages (e.g. "Şimdi öde", "Kapıda öde", "ÖDENMEDİ", "Tahsil edildi", "Vazgeç").
- **No em-dashes in user-facing copy or prose.** Use commas/periods/parentheses.
- **Amount is always derived server-side:** `app.ticketQuantity * config.ticketPrice`. Never trust a client amount.
- **DB-backed tests** follow the existing skip-if-no-Postgres pattern (probe `SELECT 1`, use `dbReady ? describe : describe.skip`).
- Run tests with `npm test` (alias for `vitest run`). Lint with `npm run lint`. Build with `npm run build`.
- All check-in/payment mutations stay single-use safe via guarded `updateMany` (the existing pattern).

---

### Task 1: `scanTicket` — payment-aware scan in `lib/tickets.ts`

A new entry point for the scanner. Looks up a ticket by `verifyToken` or human `code`, and:
- unknown identifier → `invalid`
- ticket's application is `APPROVED` (unpaid) → `unpaid` (does NOT check in)
- otherwise (`PAID`) → delegate to the existing `checkInTicket` (`valid` / `used`)

**Files:**
- Modify: `src/lib/tickets.ts` (add `ScanResult` type + `scanTicket`; leave `checkInTicket` unchanged)
- Test: `src/lib/tickets.test.ts` (add a `scanTicket` suite)

**Interfaces:**
- Consumes: existing `checkInTicket(identifier, now)`, `config.ticketPrice`, `prisma`.
- Produces:
  ```ts
  export type ScanResult =
    | { result: "valid"; holderName: string; code: string; checkedInAt: Date }
    | { result: "used"; holderName: string; code: string; checkedInAt: Date }
    | { result: "unpaid"; holderName: string; code: string; quantity: number; amount: number; applicationId: string }
    | { result: "invalid" };
  export function scanTicket(identifier: string, now?: Date): Promise<ScanResult>;
  ```

- [ ] **Step 1: Write the failing tests**

Add to `src/lib/tickets.test.ts`. The `payNewApplication` helper and `input` already exist in that file; reuse them. Add a small helper to make an APPROVED application that already has tickets (door-pass state):

```ts
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
```

Add `scanTicket` to the import on line 5 of `tickets.test.ts`:
```ts
import { attendeesFor, issueTickets, loadTicketsByAccessToken, checkInTicket, scanTicket } from "./tickets";
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- tickets.test`
Expected: FAIL — `scanTicket is not a function` / `scanTicket is not exported`.

- [ ] **Step 3: Implement `scanTicket`**

Add to `src/lib/tickets.ts` (after `checkInTicket`). `config` is already imported at the top of the file:

```ts
export type ScanResult =
  | { result: "valid"; holderName: string; code: string; checkedInAt: Date }
  | { result: "used"; holderName: string; code: string; checkedInAt: Date }
  | { result: "unpaid"; holderName: string; code: string; quantity: number; amount: number; applicationId: string }
  | { result: "invalid" };

/**
 * Payment-aware scan. An APPROVED application that already has a QR pass is a
 * "pay at the door" guest: return `unpaid` (with the whole-group amount) and do
 * NOT check in. A PAID application falls through to the normal single-use
 * check-in. `now` is injectable for tests.
 */
export async function scanTicket(
  identifier: string,
  now: Date = new Date(),
): Promise<ScanResult> {
  const ticket = await prisma.ticket.findFirst({
    where: { OR: [{ verifyToken: identifier }, { code: identifier }] },
    include: { application: true },
  });
  if (!ticket) return { result: "invalid" };

  if (ticket.application.status === "APPROVED") {
    return {
      result: "unpaid",
      holderName: ticket.holderName,
      code: ticket.code,
      quantity: ticket.application.ticketQuantity,
      amount: ticket.application.ticketQuantity * config.ticketPrice,
      applicationId: ticket.applicationId,
    };
  }

  return checkInTicket(identifier, now);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- tickets.test`
Expected: PASS (all `scanTicket` tests green; existing `checkInTicket` tests still green).

- [ ] **Step 5: Commit**

```bash
git add src/lib/tickets.ts src/lib/tickets.test.ts
git commit -m "feat: payment-aware scanTicket (unpaid branch for door passes)"
```

---

### Task 2: `collectAtDoorAndCheckIn` — confirm collection in `lib/applications.ts`

The scanner's "Tahsil edildi" action: mark the whole application paid at the door, then check in the scanned ticket. Living in `applications.ts` keeps the dependency direction clean (`applications` already imports from `tickets`; `tickets` must not import `applications`).

**Files:**
- Modify: `src/lib/applications.ts` (add `collectAtDoorAndCheckIn`; import `checkInTicket`)
- Test: `src/lib/applications.test.ts` (add a `collectAtDoorAndCheckIn` suite)

**Interfaces:**
- Consumes: existing `markPaidAtDoor(id, now)`, `NotPayableError`, and `checkInTicket` (from `./tickets`), `CheckInResult` (type from `./tickets`).
- Produces:
  ```ts
  export function collectAtDoorAndCheckIn(
    applicationId: string,
    identifier: string,
    now?: Date,
  ): Promise<CheckInResult>;
  ```

- [ ] **Step 1: Write the failing tests**

Add to `src/lib/applications.test.ts`. Extend the import on lines 5-13 to include the new function, and add imports for ticket helpers + prisma ticket access (prisma is already imported):

```ts
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
```

Add this suite:

```ts
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- applications.test`
Expected: FAIL — `collectAtDoorAndCheckIn is not exported`.

- [ ] **Step 3: Implement `collectAtDoorAndCheckIn`**

In `src/lib/applications.ts`, extend the `./tickets` import (currently `import { issueTickets } from "./tickets";` on line 5) and add the function at the end of the file:

```ts
import { issueTickets, checkInTicket, type CheckInResult } from "./tickets";
```

```ts
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- applications.test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/applications.ts src/lib/applications.test.ts
git commit -m "feat: collectAtDoorAndCheckIn (mark group paid + check in scanned ticket)"
```

---

### Task 3: `undoDoorPayment` — guard swap + reset checked-in tickets

A door-pass guest now has tickets, so the old "zero tickets" guard is wrong. Gate undo on `paymentRef === "door-pos"` instead, and reset any `USED` tickets in the group back to `VALID` so a mis-collected scan fully reverts.

**Files:**
- Modify: `src/lib/applications.ts:98-111` (the `undoDoorPayment` function)
- Test: `src/lib/applications.test.ts` (add cases to the existing `door payments` suite)

**Interfaces:**
- Consumes: `prisma`, `NotPayableError` (unchanged signature).
- Produces: `undoDoorPayment(id)` — same signature; new behavior (paymentRef-gated, resets USED→VALID).

- [ ] **Step 1: Write the failing tests**

Add to the existing `suite("door payments", ...)` in `src/lib/applications.test.ts`:

```ts
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
```

The existing test `undoDoorPayment refuses an online-paid application with tickets` stays as-is: an online payment has `paymentRef === "stub_ref"`, so the new guard still refuses it. The existing `reverts a door-paid application to APPROVED` test (no tickets) also stays green.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- applications.test`
Expected: FAIL — the new test fails because the current guard throws when `ticketCount > 0`.

- [ ] **Step 3: Update `undoDoorPayment`**

Replace the body of `undoDoorPayment` in `src/lib/applications.ts` (lines 98-111) with:

```ts
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
```

Also update the function's doc comment (lines 94-97) to:

```ts
// Revert a mistaken door mark back to APPROVED. Gated to door payments via the
// `door-pos` paymentRef so it can never undo an online payment. Door-pass guests
// keep their tickets; any ticket checked in during collection is reset to VALID.
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- applications.test`
Expected: PASS (new case green; both existing undo cases still green).

- [ ] **Step 5: Commit**

```bash
git add src/lib/applications.ts src/lib/applications.test.ts
git commit -m "feat: undoDoorPayment gates on door-pos marker and resets used tickets"
```

---

### Task 4: Scanner routes — `verify` uses `scanTicket`, new `collect` endpoint

**Files:**
- Modify: `src/app/admin/scan/verify/route.ts` (call `scanTicket` instead of `checkInTicket`)
- Modify: `src/app/admin/scan/verify/route.test.ts` (mock `scanTicket`)
- Create: `src/app/admin/scan/collect/route.ts`
- Create: `src/app/admin/scan/collect/route.test.ts`

**Interfaces:**
- Consumes: `scanTicket` (Task 1), `collectAtDoorAndCheckIn` (Task 2), `requireAdmin`.
- Produces: `POST /admin/scan/verify` returns `ScanResult` JSON; `POST /admin/scan/collect` accepts `{ token, applicationId }` and returns `CheckInResult` JSON.

- [ ] **Step 1: Update the verify route test**

Replace the mock + assertions in `src/app/admin/scan/verify/route.test.ts`. Change the hoisted mock and the `vi.mock` for `@/lib/tickets` to `scanTicket`:

```ts
const { requireAdminMock, scanMock } = vi.hoisted(() => ({
  requireAdminMock: vi.fn(),
  scanMock: vi.fn(),
}));
vi.mock("@/lib/session", () => ({ requireAdmin: requireAdminMock }));
vi.mock("@/lib/tickets", () => ({ scanTicket: scanMock }));
```

Update `beforeEach` to reset `scanMock` (default a valid result), and the assertions to reference `scanMock`:

```ts
beforeEach(() => {
  requireAdminMock.mockReset().mockResolvedValue("admin-1");
  scanMock.mockReset().mockResolvedValue({
    result: "valid",
    holderName: "Ayşe Yılmaz",
    code: "KF-7Q4X2",
    checkedInAt: new Date("2026-09-01T18:00:00.000Z"),
  });
});
```

In the three tests, replace `checkInMock` with `scanMock` (e.g. `expect(scanMock).toHaveBeenCalledWith("tok-123")`, `expect(scanMock).not.toHaveBeenCalled()`). Add one case for the unpaid passthrough:

```ts
it("passes an unpaid result straight through", async () => {
  scanMock.mockResolvedValue({
    result: "unpaid",
    holderName: "Ali Veli",
    code: "KF-AAAAA",
    quantity: 3,
    amount: 1500,
    applicationId: "app-1",
  });
  const res = await POST(req({ token: "tok-123" }));
  const json = await res.json();
  expect(json.result).toBe("unpaid");
  expect(json.amount).toBe(1500);
  expect(json.applicationId).toBe("app-1");
});
```

- [ ] **Step 2: Run the verify route test to verify it fails**

Run: `npm test -- scan/verify`
Expected: FAIL — route still imports/calls `checkInTicket`, so `scanMock` is never called.

- [ ] **Step 3: Update the verify route**

Replace `src/app/admin/scan/verify/route.ts` with:

```ts
import { requireAdmin } from "@/lib/session";
import { scanTicket } from "@/lib/tickets";

// Admin-only ticket scan. The proxy.ts cookie gate is coarse; this handler
// enforces the real boundary via requireAdmin() and returns 401 on failure
// (the scanner treats any non-200 as a transient error, not a scan result).
export async function POST(req: Request) {
  try {
    await requireAdmin();
  } catch {
    return Response.json({ result: "invalid" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const token =
    body && typeof body.token === "string" ? body.token.trim() : "";
  if (!token) return Response.json({ result: "invalid" });

  const result = await scanTicket(token);
  return Response.json(result);
}
```

- [ ] **Step 4: Run the verify route test to verify it passes**

Run: `npm test -- scan/verify`
Expected: PASS.

- [ ] **Step 5: Write the collect route test (failing)**

Create `src/app/admin/scan/collect/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const { requireAdminMock, collectMock } = vi.hoisted(() => ({
  requireAdminMock: vi.fn(),
  collectMock: vi.fn(),
}));
vi.mock("@/lib/session", () => ({ requireAdmin: requireAdminMock }));
vi.mock("@/lib/applications", () => ({ collectAtDoorAndCheckIn: collectMock }));

import { POST } from "./route";

function req(body: unknown) {
  return new Request("http://localhost/admin/scan/collect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  requireAdminMock.mockReset().mockResolvedValue("admin-1");
  collectMock.mockReset().mockResolvedValue({
    result: "valid",
    holderName: "Ali Veli",
    code: "KF-AAAAA",
    checkedInAt: new Date("2026-09-01T18:00:00.000Z"),
  });
});

describe("POST /admin/scan/collect", () => {
  it("collects + checks in and returns the result", async () => {
    const res = await POST(req({ token: "tok-1", applicationId: "app-1" }));
    expect(res.status).toBe(200);
    expect(collectMock).toHaveBeenCalledWith("app-1", "tok-1");
    const json = await res.json();
    expect(json.result).toBe("valid");
  });

  it("returns 401 and does not collect when not an admin", async () => {
    requireAdminMock.mockRejectedValue(new Error("UNAUTHORIZED"));
    const res = await POST(req({ token: "tok-1", applicationId: "app-1" }));
    expect(res.status).toBe(401);
    expect(collectMock).not.toHaveBeenCalled();
  });

  it("treats a missing token or applicationId as invalid without collecting", async () => {
    const res = await POST(req({ token: "tok-1" }));
    expect(collectMock).not.toHaveBeenCalled();
    const json = await res.json();
    expect(json.result).toBe("invalid");
  });
});
```

Run: `npm test -- scan/collect`
Expected: FAIL — `./route` has no `POST` export yet.

- [ ] **Step 6: Implement the collect route**

Create `src/app/admin/scan/collect/route.ts`:

```ts
import { requireAdmin } from "@/lib/session";
import { collectAtDoorAndCheckIn } from "@/lib/applications";

// Admin-only door collection: mark the scanned ticket's application paid at the
// gate, then check that ticket in. Same auth boundary as /admin/scan/verify.
export async function POST(req: Request) {
  try {
    await requireAdmin();
  } catch {
    return Response.json({ result: "invalid" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const token =
    body && typeof body.token === "string" ? body.token.trim() : "";
  const applicationId =
    body && typeof body.applicationId === "string" ? body.applicationId.trim() : "";
  if (!token || !applicationId) return Response.json({ result: "invalid" });

  const result = await collectAtDoorAndCheckIn(applicationId, token);
  return Response.json(result);
}
```

- [ ] **Step 7: Run both route tests to verify they pass**

Run: `npm test -- scan/`
Expected: PASS (verify + collect).

- [ ] **Step 8: Commit**

```bash
git add src/app/admin/scan/verify/route.ts src/app/admin/scan/verify/route.test.ts src/app/admin/scan/collect/route.ts src/app/admin/scan/collect/route.test.ts
git commit -m "feat: scan verify uses scanTicket; add door collect endpoint"
```

---

### Task 5: "Kapıda öde" issuance route — `pay/[token]/door-pass`

A native form POST from the pay page issues the QR pass while keeping the application `APPROVED`, emails it best-effort, and redirects back to the pay page.

**Files:**
- Create: `src/app/pay/[token]/door-pass/route.ts`
- Test: `src/lib/tickets.test.ts` already covers `issueTickets` idempotence; no new unit test for the thin route handler (it is verified via `npm run build` + manual check in Task 6). Logic it depends on is fully tested in Tasks 1-3.

**Interfaces:**
- Consumes: `assertPayable` (`@/lib/state-machine`), `issueTickets` (`@/lib/tickets`), `dispatchTickets` (`@/lib/notify/dispatch`), `prisma`, `config.appUrl`.
- Produces: `POST /pay/[token]/door-pass` → 303 redirect to `/pay/[token]`. After it runs, the application has `ticketsAccessToken` set and `status === "APPROVED"`.

- [ ] **Step 1: Implement the route**

Create `src/app/pay/[token]/door-pass/route.ts`:

```ts
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
```

- [ ] **Step 2: Verify it type-checks and builds**

Run: `npm run build`
Expected: build succeeds (route compiled, no type errors). If the build needs env vars and fails for unrelated reasons, fall back to `npx tsc --noEmit` and confirm no errors in this file.

- [ ] **Step 3: Commit**

```bash
git add src/app/pay/[token]/door-pass/route.ts
git commit -m "feat: add Kapıda öde door-pass issuance route"
```

---

### Task 6: Pay page UI — "Kapıda öde" button + door-pass state

The pay page gains a second button and a new render state. When the approved guest has not yet chosen a pass, show both "Şimdi öde" and "Kapıda öde". Once a pass is issued (door-pass chosen), show the QR tickets + PDF + a "collect at the door" banner, and still offer "Şimdi öde".

**Files:**
- Modify: `src/app/pay/[token]/page.tsx`

**Interfaces:**
- Consumes: existing `prisma` query (already `include: { tickets }`), `assertPayable`, `getPaymentProvider`, `TicketList`, `config`. New state derived from `app.ticketsAccessToken != null` while `status === "APPROVED"`.
- Produces: no exports; pure UI.

- [ ] **Step 1: Implement the door-pass button and state**

In `src/app/pay/[token]/page.tsx`, the `PAID` branch (lines 56-82) stays unchanged. Replace the section from the `assertPayable` try/catch through the end of the component (lines 84-163) with the version below. It computes `hasDoorPass`, keeps building the online `session`, and branches the markup:

```tsx
  try {
    assertPayable(app, new Date());
  } catch {
    return (
      <Shell>
        <h1 className="font-display text-3xl font-semibold text-ink">
          Bağlantının süresi doldu
        </h1>
        <p className="mt-4 leading-relaxed text-moss">
          Bu ödeme bağlantısının süresi dolmuş. Lütfen organizatörle iletişime
          geçin.
        </p>
      </Shell>
    );
  }

  const amount = app.ticketQuantity * config.ticketPrice;
  const session = await getPaymentProvider().createCheckout({
    applicationId: app.id,
    amount,
    email: app.email,
    name: app.name,
    payToken: token,
  });

  // status is APPROVED here (PAID handled above). A stamped ticketsAccessToken
  // means the guest already chose "Kapıda öde" and holds a QR pass.
  const hasDoorPass = app.ticketsAccessToken != null;

  if (hasDoorPass) {
    return (
      <Shell>
        <p className="text-xs uppercase tracking-[0.28em] text-moss">
          {config.eventName}
        </p>
        <h1 className="mt-4 font-display text-3xl font-semibold text-ink">
          Biletleriniz hazır
        </h1>

        <div className="mt-6 rounded-sm border border-hazel/30 bg-mist p-5">
          <p className="leading-relaxed text-moss">
            Girişte her bilet için karekodu okutun. Ödemeyi ({amount} TL) kapıda
            alacağız.
          </p>
        </div>

        {app.tickets.length > 0 && <TicketList tickets={app.tickets} />}

        {app.ticketsAccessToken && (
          <a
            href={`/tickets/${app.ticketsAccessToken}/pdf`}
            download="kindzi-fest-biletleri.pdf"
            className="mt-8 inline-block w-full rounded-sm bg-ink px-6 py-3.5 text-sm font-medium uppercase tracking-[0.18em] text-cream transition-all duration-300 hover:-translate-y-0.5 hover:bg-sea"
          >
            Biletleri İndir (PDF)
          </a>
        )}

        <a
          href={session.url}
          className="mt-3 inline-block w-full rounded-sm border border-ink/20 px-6 py-3.5 text-sm font-medium uppercase tracking-[0.18em] text-ink transition-all duration-300 hover:bg-ink/5"
        >
          Şimdi öde
        </a>

        <p className="mt-4 text-xs leading-relaxed text-moss/70">
          Dilerseniz girişten önce online ödeyebilirsiniz. Biletleriniz ayrıca
          e-posta ile gönderildi.
        </p>
      </Shell>
    );
  }

  return (
    <Shell>
      <p className="text-xs uppercase tracking-[0.28em] text-moss">
        {config.eventName}
      </p>
      <h1 className="mt-4 font-display text-3xl font-semibold text-ink">
        Ödeme
      </h1>

      <div className="mt-8 rounded-sm border border-ink/10 bg-mist p-6">
        <p className="text-moss">{app.ticketQuantity} bilet</p>
        <p className="mt-1 font-display text-5xl font-semibold text-hazel">
          {amount} TL
        </p>
      </div>

      <a
        href={session.url}
        className="mt-8 inline-block w-full rounded-sm bg-ink px-6 py-3.5 text-sm font-medium uppercase tracking-[0.18em] text-cream transition-all duration-300 hover:-translate-y-0.5 hover:bg-sea"
      >
        Şimdi öde
      </a>

      <form action={`/pay/${token}/door-pass`} method="post" className="mt-3">
        <button
          type="submit"
          className="w-full rounded-sm border border-ink/20 px-6 py-3.5 text-sm font-medium uppercase tracking-[0.18em] text-ink transition-all duration-300 hover:bg-ink/5"
        >
          Kapıda öde
        </button>
      </form>

      <p className="mt-4 text-xs leading-relaxed text-moss/70">
        &quot;Kapıda öde&quot; biletinizi karekodla hemen verir, ödemeyi girişte
        alırız. &quot;Şimdi öde&quot; ile online ödeme güvenli sayfada tamamlanır.
      </p>

      <p className="mt-3 text-xs leading-relaxed text-moss/70">
        Ödeme yaparak{" "}
        <a
          href="/mesafeli-satis-sozlesmesi"
          className="text-hazel underline underline-offset-4 hover:text-ink"
        >
          Mesafeli Satış Sözleşmesi
        </a>{" "}
        ve{" "}
        <a
          href="/teslimat-iade"
          className="text-hazel underline underline-offset-4 hover:text-ink"
        >
          Teslimat ve İade Şartları
        </a>
        &apos;nı kabul etmiş olursunuz. Biletler iade edilemez.
      </p>

      <Image
        src="/payment/iyzico-ile-ode.svg"
        alt="iyzico ile öde"
        width={210}
        height={31}
        className="mx-auto mt-6 h-auto w-[180px]"
      />
    </Shell>
  );
```

- [ ] **Step 2: Lint + build**

Run: `npm run lint && npm run build`
Expected: no lint errors; build succeeds. (If `build` fails on env/DB unrelated to this file, run `npx tsc --noEmit` and confirm this file is clean.)

- [ ] **Step 3: Manual verification**

Start `npm run dev`. Approve a test application in `/admin`, open its pay link. Confirm:
1. Both "Şimdi öde" and "Kapıda öde" appear.
2. Tapping "Kapıda öde" reloads the pay page into the "Biletleriniz hazır" state with QR tickets, a PDF button, the collect-at-door banner, and a secondary "Şimdi öde".
3. The application is still `APPROVED` in `/admin` (not paid).

- [ ] **Step 4: Commit**

```bash
git add src/app/pay/[token]/page.tsx
git commit -m "feat: pay page offers Kapıda öde and shows the door-pass state"
```

---

### Task 7: Scanner UI — unpaid overlay with collect / cancel

Add the `unpaid` result to the scanner. An unpaid scan shows a blue full-screen overlay with the amount and two actions: "Tahsil edildi" (POST `/admin/scan/collect`, then show the resulting check-in) and "Vazgeç" (dismiss). Unlike the other results, the unpaid overlay must NOT auto-dismiss.

**Files:**
- Modify: `src/app/admin/scan/scanner.tsx`

**Interfaces:**
- Consumes: `POST /admin/scan/verify` (now may return `unpaid`) and `POST /admin/scan/collect` (Task 4).
- Produces: no exports; client UI.

- [ ] **Step 1: Implement the unpaid flow**

Replace `src/app/admin/scan/scanner.tsx` with the version below. Changes from the current file: a wider `ScanResult` type, no auto-dismiss timer for `unpaid`, a `collect()` action, and an unpaid blue overlay with two buttons.

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";

type ScanResult =
  | { result: "valid"; holderName: string; code: string; checkedInAt: string }
  | { result: "used"; holderName: string; code: string; checkedInAt: string }
  | { result: "unpaid"; holderName: string; code: string; quantity: number; amount: number; applicationId: string }
  | { result: "invalid" };

const READER_ID = "kf-scan-reader";
const RESULT_MS = 2500;

export default function Scanner() {
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualValue, setManualValue] = useState("");

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const busyRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The token of the current scan, kept so an unpaid overlay can confirm collection.
  const tokenRef = useRef<string>("");

  // Auto-dismiss every result EXCEPT unpaid, which waits for a staff decision.
  function scheduleDismiss(next: ScanResult | null) {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    if (next && next.result !== "unpaid") {
      timerRef.current = setTimeout(dismiss, RESULT_MS);
    }
  }

  async function verify(token: string) {
    setError(null);
    tokenRef.current = token;
    try {
      const res = await fetch("/admin/scan/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (!res.ok) {
        setError("Yetki hatası veya bağlantı sorunu. Tekrar deneyin.");
        return;
      }
      const data = (await res.json()) as ScanResult;
      setResult(data);
      scheduleDismiss(data);
    } catch {
      setError("Bağlantı hatası. Tekrar deneyin.");
    }
  }

  async function collect(applicationId: string) {
    setError(null);
    try {
      const res = await fetch("/admin/scan/collect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: tokenRef.current, applicationId }),
      });
      if (!res.ok) {
        setError("Tahsilat kaydedilemedi. Tekrar deneyin.");
        return;
      }
      const data = (await res.json()) as ScanResult;
      setResult(data);
      scheduleDismiss(data);
    } catch {
      setError("Bağlantı hatası. Tekrar deneyin.");
    }
  }

  function dismiss() {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    setResult(null);
    busyRef.current = false;
    try {
      scannerRef.current?.resume();
    } catch {
      // resume throws only if not paused; safe to ignore.
    }
  }

  async function handleDecode(token: string) {
    if (busyRef.current) return; // debounce: ignore repeat frames of the same scan
    busyRef.current = true;
    try {
      scannerRef.current?.pause(true);
    } catch {
      // pause throws only if not scanning; safe to ignore.
    }
    await verify(token);
  }

  useEffect(() => {
    const scanner = new Html5Qrcode(READER_ID);
    scannerRef.current = scanner;
    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decoded) => {
          void handleDecode(decoded);
        },
        () => {
          // per-frame decode failure; ignore.
        },
      )
      .catch(() => {
        setCameraError(
          "Kamera açılamadı. Kamera izni verildiğinden ve güvenli bağlantı kullanıldığından emin olun. Aşağıdan kod ile giriş yapabilirsiniz.",
        );
        setManualOpen(true);
      });

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      scanner
        .stop()
        .then(() => scanner.clear())
        .catch(() => {
          // already stopped / never started; ignore.
        });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    const v = manualValue.trim();
    if (!v) return;
    if (busyRef.current) return; // debounce: ignore duplicate submits while a result is shown
    busyRef.current = true;
    setManualValue("");
    void verify(v);
  }

  const bg =
    result?.result === "valid"
      ? "bg-green-600"
      : result?.result === "used"
        ? "bg-amber-500"
        : result?.result === "unpaid"
          ? "bg-sky-700"
          : "bg-red-600";

  return (
    <div className="mt-6">
      <div id={READER_ID} className="overflow-hidden rounded-sm border border-ink/10" />

      {cameraError && <p className="mt-3 text-sm text-red-600">{cameraError}</p>}
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <button
        type="button"
        onClick={() => setManualOpen((o) => !o)}
        className="mt-4 text-sm text-sea underline"
      >
        {manualOpen ? "Kod girişini kapat" : "Kod gir (KF-...)"}
      </button>

      {manualOpen && (
        <form onSubmit={onManualSubmit} className="mt-3 flex gap-2">
          <input
            value={manualValue}
            onChange={(e) => setManualValue(e.target.value)}
            placeholder="KF-XXXXX"
            autoCapitalize="characters"
            className="flex-1 rounded-sm border border-ink/20 px-3 py-2 text-sm"
          />
          <button className="rounded-sm bg-ink px-4 py-2 text-sm text-cream">
            Onayla
          </button>
        </form>
      )}

      {result && result.result === "unpaid" && (
        <div className={`fixed inset-0 z-50 flex flex-col items-center justify-center px-6 text-center text-white ${bg}`}>
          <span className="text-6xl leading-none">₺</span>
          <span className="mt-4 text-2xl font-semibold uppercase tracking-wide">
            Ödenmedi
          </span>
          <span className="mt-6 text-3xl font-bold">{result.holderName}</span>
          <span className="mt-1 text-lg opacity-90">{result.code}</span>
          <span className="mt-6 text-4xl font-bold">
            {result.amount} TL
          </span>
          <span className="mt-1 text-sm opacity-90">{result.quantity} bilet</span>
          <div className="mt-10 flex w-full max-w-xs flex-col gap-3">
            <button
              type="button"
              onClick={() => collect(result.applicationId)}
              className="rounded-sm bg-white px-6 py-3.5 text-sm font-semibold uppercase tracking-wide text-sky-800"
            >
              Tahsil edildi
            </button>
            <button
              type="button"
              onClick={dismiss}
              className="rounded-sm border border-white/60 px-6 py-3.5 text-sm font-medium uppercase tracking-wide text-white"
            >
              Vazgeç
            </button>
          </div>
        </div>
      )}

      {result && result.result !== "unpaid" && (
        <button
          type="button"
          onClick={dismiss}
          className={`fixed inset-0 z-50 flex flex-col items-center justify-center px-6 text-center text-white ${bg}`}
        >
          <span className="text-7xl leading-none">
            {result.result === "valid" ? "✓" : result.result === "used" ? "!" : "✕"}
          </span>
          <span className="mt-4 text-2xl font-semibold uppercase tracking-wide">
            {result.result === "valid"
              ? "Geçerli"
              : result.result === "used"
                ? "Zaten okutuldu"
                : "Geçersiz"}
          </span>
          {result.result !== "invalid" && (
            <>
              <span className="mt-6 text-3xl font-bold">{result.holderName}</span>
              <span className="mt-1 text-lg opacity-90">{result.code}</span>
            </>
          )}
          {result.result === "used" && (
            <span className="mt-4 text-sm opacity-80">
              Giriş zamanı:{" "}
              {new Date(result.checkedInAt).toLocaleTimeString("tr-TR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}
          <span className="mt-10 text-xs uppercase tracking-widest opacity-70">
            Devam etmek için dokun
          </span>
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Lint + build**

Run: `npm run lint && npm run build`
Expected: no lint errors; build succeeds.

- [ ] **Step 3: Manual verification (end-to-end)**

With `npm run dev` and a logged-in admin:
1. Create + approve an application, open its pay link, tap "Kapıda öde" to get the QR pass (PDF).
2. Open `/admin/scan`, scan/enter one ticket of that group → blue "Ödenmedi" overlay with the full group amount and two buttons.
3. Tap "Tahsil edildi" → flips to green "Geçerli" and auto-dismisses. The application is now `PAID` (`door-pos`) in `/admin`.
4. Scan another member of the same group → green "Geçerli" straight through (no second collection).
5. Scan the first member again → amber "Zaten okutuldu".
6. (Undo) On `/admin/door`, "Geri al" on that application reverts it to `APPROVED` and the scanned ticket back to scannable.

- [ ] **Step 4: Full test + commit**

Run: `npm test`
Expected: all suites pass (DB-backed suites run if Postgres is reachable; otherwise skipped).

```bash
git add src/app/admin/scan/scanner.tsx
git commit -m "feat: scanner unpaid overlay collects door payment then checks in"
```

---

## Self-Review

**Spec coverage:**
- Pay page "Kapıda öde" + door-pass state → Task 6. ✅
- Door-pass issuance route → Task 5. ✅
- Scanner unpaid branch (verify) → Tasks 1, 4. ✅
- Scanner confirm (collect + check in, group once) → Tasks 2, 4, 7. ✅
- `undoDoorPayment` guard swap + USED→VALID reset → Task 3. ✅
- No schema change → confirmed across all tasks. ✅
- Edge cases (online-pay-after-door-pass idempotent; double-tap no-op; forwarded QR never admits) → covered by reused idempotent `issueTickets`/`markPaidByToken` and guarded `markPaidAtDoor`/`checkInTicket`; tested in Tasks 1-3. ✅

**Placeholder scan:** No TBD/TODO; every code step shows complete code. ✅

**Type consistency:** `ScanResult` (Tasks 1, 4, 7) and `CheckInResult` (Tasks 2, 4) names and shapes match across tasks. `scanTicket(identifier, now?)`, `collectAtDoorAndCheckIn(applicationId, identifier, now?)`, and the routes' `{ token, applicationId }` body all line up. ✅
