# Pay at the Gate — Restore Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an admin issue a QR ticket to an APPROVED-but-unpaid booking so the guest pays at the gate on arrival.

**Architecture:** Mirror the existing Havale confirm/undo button pair. Two new lib functions (`issueGatePass` / `revokeGatePass`) reuse the already-idempotent `issueTickets`; a gate-specific email is delivered via a refactored shared dispatcher; two admin server actions and a pair of buttons in the admin list complete the loop. The scanner and door-collection code already handle an APPROVED guest holding a QR, so they are untouched.

**Tech Stack:** Next.js (app router, server actions — note breaking changes, see Global Constraints), Prisma + Postgres, Vitest (DB-backed + mock-based), React (server-rendered).

## Global Constraints

- **Read the Next.js docs first.** Per `AGENTS.md`: "This is NOT the Next.js you know." Before writing or editing any route / server-action / page code, read the relevant guide in `node_modules/next/dist/docs/`.
- **No schema or migration changes.** The `Status` enum (`PENDING | APPROVED | REJECTED | PAID`) and all fields (`ticketsAccessToken`, `ticketsDeliveredAt`, `paidAt`, `paymentRef`, `amount`, `Ticket.status`) already exist.
- **Ticket price source:** amount due is always derived server-side as `ticketQuantity * config.ticketPrice`; never trust client input.
- **Turkish copy** for all guest-facing strings (this is a Turkish festival).
- **Test DB prerequisite:** DB-backed tests run against a separate Postgres database (`<your db>_test`, e.g. `festival_gate_test`). It must be reachable and migrated, or those tests `describe.skip` themselves. Run `npx prisma migrate deploy` against the test DB if needed.
- **Commits:** prefix git commands with `rtk` (per repo CLAUDE.md). End every commit message with the trailer `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- **Branch:** work on `feat/pay-at-gate-restore` (already created; the spec is committed there).

---

### Task 1: `issueGatePass` and `revokeGatePass` lib functions

**Files:**
- Modify: `src/lib/applications.ts` (add two exported functions near `markPaidAtDoor` / `undoDoorPayment`, around line 106–156)
- Test: `src/lib/applications.test.ts` (add a new `suite("gate pass", …)` block)

**Interfaces:**
- Consumes: `issueTickets(tx, app)` from `./tickets` (already imported in this file; idempotent — returns existing tickets and creates nothing once `ticketsAccessToken` is set). `TransitionError` and `NotPayableError` (already defined/used in this file).
- Produces:
  - `issueGatePass(id: string): Promise<Application & { tickets: Ticket[] }>` — issues the QR for an APPROVED booking, leaves it APPROVED/unpaid.
  - `revokeGatePass(id: string): Promise<Application>` — deletes the pass and clears the token; refuses if PAID or any ticket is USED.

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/applications.test.ts` (the imports `createApplication`, `approveApplication`, `markPaidByHavale`, `prisma`, `config`, `issueTickets` already exist at the top; add `issueGatePass` and `revokeGatePass` to the existing import block from `./applications`):

```ts
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `rtk npx vitest run src/lib/applications.test.ts`
Expected: FAIL — `issueGatePass is not a function` / `revokeGatePass is not a function` (import errors), or the new suite errors. (If the whole suite reports `skip`, the test DB is unreachable — fix that per Global Constraints before continuing.)

- [ ] **Step 3: Implement the two functions**

In `src/lib/applications.ts`, add after `undoDoorPayment` (around line 156):

```ts
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `rtk npx vitest run src/lib/applications.test.ts`
Expected: PASS (all existing tests plus the 6 new gate-pass tests).

- [ ] **Step 5: Commit**

```bash
rtk git add src/lib/applications.ts src/lib/applications.test.ts
rtk git commit -m "feat(applications): add issueGatePass and revokeGatePass

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Gate-pass email + shared dispatcher

**Files:**
- Modify: `src/lib/notify/types.ts` (add `buildGatePassEmail`)
- Modify: `src/lib/notify/dispatch.ts` (extract shared `deliverPass`, add `dispatchGatePass`)
- Test: `src/lib/notify/types.test.ts` (add a `buildGatePassEmail` test)
- Test: `src/lib/notify/dispatch.test.ts` (add a `dispatchGatePass` describe block)

**Interfaces:**
- Consumes: `EmailMessage` type, `config`, `renderTicketsPdf`, `notify`, `getWhatsAppSender().sendTicketsLink` (all already used in `dispatch.ts`).
- Produces:
  - `buildGatePassEmail(p: { eventName: string; name: string; ticketsUrl: string }): EmailMessage`
  - `dispatchGatePass(app: { name: string; email: string; phone: string | null; ticketsAccessToken: string | null }, tickets: Ticket[]): Promise<void>`

- [ ] **Step 1: Write the failing email-builder test**

Append to `src/lib/notify/types.test.ts` (add `buildGatePassEmail` to the existing import from `./types`):

```ts
describe("buildGatePassEmail", () => {
  it("names the event in the subject and signals payment is due at the gate", () => {
    const msg = buildGatePassEmail({
      eventName: "KİNDZİ FEST",
      name: "Ali",
      ticketsUrl: "https://x/tickets/tok-1",
    });
    expect(msg.subject).toContain("KİNDZİ FEST");
    expect(msg.text).toContain("Ali");
    expect(msg.text).toContain("girişte"); // pay-at-the-gate wording
    expect(msg.text).toContain("https://x/tickets/tok-1");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `rtk npx vitest run src/lib/notify/types.test.ts`
Expected: FAIL — `buildGatePassEmail is not a function`.

- [ ] **Step 3: Implement `buildGatePassEmail`**

Append to `src/lib/notify/types.ts`:

```ts
export function buildGatePassEmail(p: { eventName: string; name: string; ticketsUrl: string }): EmailMessage {
  return {
    subject: `${p.eventName} QR biletiniz hazır — ödeme girişte`,
    text:
      `Merhaba ${p.name},\n\n` +
      `${p.eventName} için QR biletiniz hazır ve bu e-postaya PDF olarak eklenmiştir.\n` +
      `ÖNEMLİ: Bilet ücretini etkinlik girişinde ödeyeceksiniz; ödemeniz henüz alınmadı.\n` +
      `Biletinizi çevrimiçi görüntülemek için:\n${p.ticketsUrl}\n\n` +
      `Girişte bu biletteki karekodu okutup ödemenizi yapmanız yeterlidir. Etkinlikte görüşmek üzere!`,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `rtk npx vitest run src/lib/notify/types.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing dispatch test**

In `src/lib/notify/dispatch.test.ts`, change the import line to also import `dispatchGatePass`:

```ts
import { dispatchPayLink, dispatchTickets, dispatchGatePass } from "./dispatch";
```

Then append a new describe block (reuses the existing `baseApp`, `tickets`, and mocks):

```ts
describe("dispatchGatePass", () => {
  it("emails the gate-pass copy with a PDF attachment and the retrieval link", async () => {
    await dispatchGatePass({ ...baseApp }, tickets);
    expect(renderMock).toHaveBeenCalledTimes(1);
    expect(notifyMock).toHaveBeenCalledTimes(1);
    const [to, msg] = notifyMock.mock.calls[0];
    expect(to).toBe("a@x.com");
    expect(msg.attachments[0].content).toBeInstanceOf(Buffer);
    expect(msg.subject).toContain("ödeme girişte");
    expect(msg.text).toContain("https://x/tickets/tok-abc");
    expect(sendTicketsLinkMock).not.toHaveBeenCalled();
  });

  it("also sends the WhatsApp retrieval link when a phone is present", async () => {
    await dispatchGatePass({ ...baseApp, phone: "+905551112233" }, tickets);
    expect(sendTicketsLinkMock).toHaveBeenCalledTimes(1);
    const [phone, vars] = sendTicketsLinkMock.mock.calls[0];
    expect(phone).toBe("+905551112233");
    expect(vars.ticketsUrl).toBe("https://x/tickets/tok-abc");
  });

  it("skips delivery entirely when ticketsAccessToken is missing (no dead link)", async () => {
    await expect(
      dispatchGatePass({ ...baseApp, ticketsAccessToken: null }, tickets),
    ).resolves.toBeUndefined();
    expect(renderMock).not.toHaveBeenCalled();
    expect(notifyMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 6: Run the dispatch test to verify it fails**

Run: `rtk npx vitest run src/lib/notify/dispatch.test.ts`
Expected: FAIL — `dispatchGatePass is not a function`.

- [ ] **Step 7: Refactor `dispatch.ts` to share delivery, add `dispatchGatePass`**

In `src/lib/notify/dispatch.ts`:

(a) Update the `./types` import to include the new builder and the `EmailMessage` type:

```ts
import { buildApprovalEmail, buildTicketsEmail, buildGatePassEmail } from "./types";
import type { EmailMessage } from "./types";
```

(b) Replace the entire body of `dispatchTickets` (lines ~42–79) with a call to a shared private helper, and add the helper + `dispatchGatePass`:

```ts
type DeliverableApp = {
  name: string;
  email: string;
  phone: string | null;
  ticketsAccessToken: string | null;
};

// Shared delivery for any QR pass: ALWAYS email (PDF attached), and ADDITIONALLY
// WhatsApp a retrieval link when a phone is present. Every channel is
// best-effort — a failure logs and never undoes ticket issuance. `buildEmail`
// selects the copy (paid tickets vs. pay-at-the-gate) and `context` labels logs.
async function deliverPass(
  app: DeliverableApp,
  tickets: Ticket[],
  buildEmail: (p: { eventName: string; name: string; ticketsUrl: string }) => EmailMessage,
  context: string,
): Promise<void> {
  // Issuance always stamps ticketsAccessToken in the same transaction that issues
  // the tickets, so this should never be null on the real path. Guard anyway:
  // without it we'd email a dead ".../tickets/null" link. Fail loudly.
  if (!app.ticketsAccessToken) {
    console.error(`[dispatch] ${context} delivery skipped: no ticketsAccessToken for ${app.email}`);
    return;
  }

  const ticketsUrl = `${config.appUrl}/tickets/${app.ticketsAccessToken}`;

  // Email (with PDF attachment). notify() is already best-effort internally.
  try {
    const pdf = await renderTicketsPdf({ name: app.name }, tickets);
    await notify(app.email, {
      ...buildEmail({ eventName: config.eventName, name: app.name, ticketsUrl }),
      attachments: [{ filename: "kindzi-fest-biletleri.pdf", content: pdf }],
    });
  } catch (err) {
    console.error(`[dispatch] ${context} email failed to=${app.email}`, err);
  }

  // WhatsApp link (only when a phone is present).
  if (app.phone) {
    try {
      await getWhatsAppSender().sendTicketsLink(app.phone, {
        name: app.name,
        ticketsUrl,
        eventName: config.eventName,
      });
    } catch (err) {
      console.error(`[dispatch] ${context} whatsapp send failed to=${app.phone}`, err);
    }
  }
}

// Deliver the paid tickets.
export async function dispatchTickets(app: DeliverableApp, tickets: Ticket[]): Promise<void> {
  return deliverPass(app, tickets, buildTicketsEmail, "tickets");
}

// Deliver an unpaid "pay at the gate" QR pass: same channels as dispatchTickets,
// but the email copy tells the guest payment is due at the gate.
export async function dispatchGatePass(app: DeliverableApp, tickets: Ticket[]): Promise<void> {
  return deliverPass(app, tickets, buildGatePassEmail, "gate pass");
}
```

Keep `dispatchPayLink` unchanged.

- [ ] **Step 8: Run both test files to verify they pass**

Run: `rtk npx vitest run src/lib/notify/dispatch.test.ts src/lib/notify/types.test.ts`
Expected: PASS — existing `dispatchTickets` / `dispatchPayLink` tests still green (behavior unchanged by the refactor), plus the new gate-pass tests.

- [ ] **Step 9: Commit**

```bash
rtk git add src/lib/notify/types.ts src/lib/notify/types.test.ts src/lib/notify/dispatch.ts src/lib/notify/dispatch.test.ts
rtk git commit -m "feat(notify): gate-pass email + shared deliverPass dispatcher

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Admin server actions + list buttons

**Files:**
- Modify: `src/app/admin/actions.ts` (add `giveGatePassAction`, `revokeGatePassAction`)
- Modify: `src/app/admin/page.tsx` (extend the `APPROVED` branch of `ApplicationActions`)

**Interfaces:**
- Consumes: `issueGatePass`, `revokeGatePass` from `@/lib/applications`; `dispatchGatePass` from `@/lib/notify/dispatch`; `requireAdmin`, `revalidatePath`, `config`, `CopyLink` (all already imported in the respective files).
- Produces: two server actions usable as `<form action={…}>` handlers.

> This task has no automated test: the repo has no tests for `admin/actions.ts` or `admin/page.tsx`, and `renderToStaticMarkup` cannot reliably render forms wired to server actions plus the `CopyLink` client component. The real logic is covered by Tasks 1–2. Verification here is `tsc` + the manual checklist in Step 4.

- [ ] **Step 1: Read the Next.js docs, then add the server actions**

First, per `AGENTS.md`, read the server-actions guide under `node_modules/next/dist/docs/` (search for "server actions" / "use server").

In `src/app/admin/actions.ts`:

(a) Extend the imports:

```ts
import {
  approveApplication,
  rejectApplication,
  reissuePayLink,
  markPaidByHavale,
  undoHavalePayment,
  issueGatePass,
  revokeGatePass,
} from "@/lib/applications";
import { dispatchPayLink, dispatchTickets, dispatchGatePass } from "@/lib/notify/dispatch";
```

(b) Append the two actions at the end of the file:

```ts
export async function giveGatePassAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const app = await issueGatePass(id);
  // Best-effort delivery: a send failure must never undo the issued pass.
  await dispatchGatePass(app, app.tickets);
  revalidatePath("/admin");
}

export async function revokeGatePassAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  await revokeGatePass(id);
  revalidatePath("/admin");
}
```

- [ ] **Step 2: Wire the buttons into the admin list**

In `src/app/admin/page.tsx`:

(a) Add the two actions to the import from `./actions`:

```ts
import {
  approveAction,
  rejectAction,
  resendLinkAction,
  confirmHavaleAction,
  undoHavaleAction,
  giveGatePassAction,
  revokeGatePassAction,
} from "./actions";
```

(b) In `ApplicationActions`, replace the existing `APPROVED` block (lines ~78–90) with this version, which adds the gate-pass toggle after the Havale button:

```tsx
      {a.status === "APPROVED" && a.payToken && (
        <>
          <CopyLink url={`${config.appUrl}/pay/${a.payToken}`} label="Kopyala" />
          <form action={resendLinkAction}>
            <input type="hidden" name="id" value={a.id} />
            <button className={BTN_SECONDARY}>Yeniden gönder</button>
          </form>
          <form action={confirmHavaleAction}>
            <input type="hidden" name="id" value={a.id} />
            <button className={`${BTN_PRIMARY} bg-hazel`}>Havale&apos;yi onayla</button>
          </form>
          {a.ticketsAccessToken == null ? (
            <form action={giveGatePassAction}>
              <input type="hidden" name="id" value={a.id} />
              <button className={`${BTN_PRIMARY} bg-moss`}>Kapıda öde bileti ver</button>
            </form>
          ) : (
            <>
              <CopyLink
                url={`${config.appUrl}/tickets/${a.ticketsAccessToken}`}
                label="Bilet bağlantısı"
              />
              <form action={revokeGatePassAction}>
                <input type="hidden" name="id" value={a.id} />
                <button className={BTN_SECONDARY}>Bileti iptal et</button>
              </form>
            </>
          )}
        </>
      )}
```

(Leave the `PENDING` and `PAID` branches and `hasActions` unchanged — an APPROVED row always has a `payToken`, so `hasActions` already returns true for it.)

- [ ] **Step 3: Typecheck and build**

Run: `rtk tsc --noEmit`
Expected: no errors.

Run: `rtk npx vitest run`
Expected: full suite PASS (no regressions; this task adds no new tests).

- [ ] **Step 4: Manual verification**

Start the app (`npm run dev`), log in to `/admin`, and confirm against a test booking:

1. An **APPROVED** booking with no pass shows a **"Kapıda öde bileti ver"** button.
2. Tapping it: the row now shows **"Bilet bağlantısı"** + **"Bileti iptal et"**, and the guest email (console notifier in dev) contains the "ödeme girişte" wording with a PDF.
3. Tapping **"Bileti iptal et"**: the row returns to showing **"Kapıda öde bileti ver"**.
4. Open the issued ticket link, then go to `/admin/m` (Kapı) and scan/enter the code — the door screen shows the amount due (unpaid), and collecting marks it PAID (`door-pos`).
5. After a successful gate check-in, **"Bileti iptal et"** is refused (guest already used the ticket) — verify the action does not crash the page.

- [ ] **Step 5: Commit**

```bash
rtk git add src/app/admin/actions.ts src/app/admin/page.tsx
rtk git commit -m "feat(admin): give/revoke pay-at-gate pass buttons

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- `issueGatePass` / `revokeGatePass` (spec Components 1) → Task 1. ✓
- Gate email `buildGatePassEmail` + `dispatchGatePass` (spec Components 2) → Task 2. ✓
- Admin actions `giveGatePassAction` / `revokeGatePassAction` (spec Components 3) → Task 3 Step 1. ✓
- Admin buttons + state branching (spec Components 4) → Task 3 Step 2. ✓
- Revoke refuses on USED ticket (spec Error handling) → Task 1 implementation + test. ✓
- No schema change, scanner untouched, WhatsApp reuses `sendTicketsLink` (spec Data model / Out of scope) → honored across tasks. ✓
- Spec "ApplicationActions render test" → **deliberately replaced** by `tsc` + manual checklist (Task 3 note), because the repo has no DOM test infra and `renderToStaticMarkup` can't render server-action forms reliably. The state logic is trivial JSX branching; the substantive logic is fully unit-tested in Tasks 1–2.

**Placeholder scan:** No TBD/TODO; every code step contains complete code and exact commands. ✓

**Type consistency:** `issueGatePass` returns `Application & { tickets }` and `giveGatePassAction` consumes `app.tickets` → matches. `dispatchGatePass`/`dispatchTickets` share the `DeliverableApp` shape and the `(p) => EmailMessage` builder signature, which both `buildTicketsEmail` and `buildGatePassEmail` satisfy → matches. `revokeGatePass` returns `Application` and `revokeGatePassAction` ignores the return → matches. ✓
