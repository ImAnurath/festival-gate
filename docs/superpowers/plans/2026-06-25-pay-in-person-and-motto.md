# Pay-in-Person Request + Motto Pickup — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an approved guest request to pay in person (admin sees a badge and issues the gate pass), and tell guests they can also buy a physical ticket at Motto.

**Architecture:** One nullable `Application.payInPersonRequestedAt` flag, set by a public server action from the pay page. A shared `MOTTO_PICKUP` constant surfaces the pickup address in the gate-pass email, the ticket page, and the pay-page confirmation. The admin list shows a badge for a pending request; the admin then uses the existing "Kapıda öde bileti ver" button (built in the base feature).

**Tech Stack:** Next.js (app router, server actions — modified version, read docs), Prisma + Postgres, Vitest (DB-backed + mock-based).

## Global Constraints

- **Read the Next.js docs first.** Per `AGENTS.md`: before writing/editing any route, server action, or page, read the relevant guide in `node_modules/next/dist/docs/`.
- **Motto address verbatim:** `Motto — Mustafakemalpaşa, Motto Sokak No:12, 52400 Fatsa/Ordu, Türkiye`. Define it ONCE as a shared constant; never inline the string twice.
- **Turkish, grammatically correct** for all guest-facing copy. Button label exactly `Şahsen ödemek istiyorum`. Admin badge exactly `Şahsen ödeme istedi`. Confirmation exactly `Talebiniz alındı; organizatör biletinizi en kısa sürede gönderecek.`
- **No new `Status` value.** `payInPersonRequestedAt` is a flag, not a state. The booking stays APPROVED until the admin issues the pass.
- **Do not change** the base-feature behavior: `issueGatePass`/`revokeGatePass`, the Havale flow, the scanner/door code.
- **Public action safety:** `requestPayInPersonAction` is NOT admin-gated; it must only ever set the flag (no ticket issuance, no payment, no data disclosure) and be a silent no-op on a bad/expired/non-APPROVED token.
- **Test DB:** DB-backed tests run against `<dev-db>_test`. After the schema migration, that DB must receive the migration or new-column tests fail. If DB tests self-skip, STOP and report it (do not mark done with skipped DB tests).
- **Commits:** end every commit message with `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- **Branch:** continue on `feat/pay-at-gate-restore`.

---

### Task 1: Schema field + `requestPayInPerson` lib function

**Files:**
- Modify: `prisma/schema.prisma` (add one field to the `Application` model)
- Create: a migration under `prisma/migrations/` (via `prisma migrate dev`)
- Modify: `src/lib/applications.ts` (add `requestPayInPerson`)
- Test: `src/lib/applications.test.ts` (new `suite("requestPayInPerson", …)`)

**Interfaces:**
- Produces: `requestPayInPerson(payToken: string): Promise<void>` — stamps `payInPersonRequestedAt` on an APPROVED booking matching `payToken`, only when currently null; silent no-op otherwise.

- [ ] **Step 1: Add the schema field**

In `prisma/schema.prisma`, in the `Application` model, add (next to the other optional timestamps such as `paidAt` / `ticketsDeliveredAt`):

```prisma
  payInPersonRequestedAt DateTime?
```

- [ ] **Step 2: Create and apply the migration (dev DB + client)**

Run: `npx prisma migrate dev --name add_pay_in_person_requested_at`
Expected: a new migration folder is created, applied to the dev DB, and the Prisma client is regenerated. (If it prompts, do not reset the DB.)

- [ ] **Step 3: Apply the migration to the test DB**

The test DB is the dev `DATABASE_URL` database name with `_test` appended (see `vitest.config.ts`). Apply the migration there so DB tests can see the new column. In bash from the repo root:

```bash
# derive the _test URL from .env DATABASE_URL and deploy migrations to it
node -e "const u=new URL(process.env.DATABASE_URL||require('dotenv').config({path:'.env'})&&process.env.DATABASE_URL); if(!u.pathname.endsWith('_test'))u.pathname+='_test'; process.stdout.write(u.toString())" > /tmp/testdburl 2>/dev/null || true
DATABASE_URL="$(cat /tmp/testdburl)" npx prisma migrate deploy
```

If that derivation is awkward in your shell, instead read `DATABASE_URL` from `.env`, append `_test` to the database name, and run `DATABASE_URL=<that> npx prisma migrate deploy`. Expected: "migrations applied" against the `_test` database.

- [ ] **Step 4: Write the failing tests**

Add `requestPayInPerson` to the existing import block from `./applications` at the top of `src/lib/applications.test.ts`, then append:

```ts
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
```

- [ ] **Step 5: Run the tests to verify they fail**

Run: `npx vitest run src/lib/applications.test.ts`
Expected: FAIL — `requestPayInPerson is not a function`. (If the whole suite reports `skip`, the test DB is unreachable/unmigrated — fix per Global Constraints before continuing.)

- [ ] **Step 6: Implement `requestPayInPerson`**

In `src/lib/applications.ts`, add near `reissuePayLink` (it is the other payToken-keyed APPROVED guard):

```ts
// Record that an APPROVED guest asked to pay in person. Sets the flag only when
// currently null (idempotent) and only while APPROVED — a request on an unknown,
// expired, or non-APPROVED booking is a silent no-op so a stale pay tab can never
// error. Touches no payment or ticket fields; the admin still issues the pass.
export async function requestPayInPerson(payToken: string): Promise<void> {
  await prisma.application.updateMany({
    where: { payToken, status: "APPROVED", payInPersonRequestedAt: null },
    data: { payInPersonRequestedAt: new Date() },
  });
}
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run src/lib/applications.test.ts`
Expected: PASS (existing tests + 3 new `requestPayInPerson` tests).

- [ ] **Step 8: Commit**

```bash
git add prisma/schema.prisma prisma/migrations src/lib/applications.ts src/lib/applications.test.ts
git commit -m "feat(applications): add payInPersonRequestedAt flag + requestPayInPerson

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Motto constant + gate-pass email copy

**Files:**
- Create: `src/lib/venue.ts` (the shared `MOTTO_PICKUP` constant)
- Modify: `src/lib/notify/types.ts` (`buildGatePassEmail` includes the Motto line)
- Test: `src/lib/notify/types.test.ts` (assert the Motto address is in the body)

**Interfaces:**
- Produces: `export const MOTTO_PICKUP: string` in `src/lib/venue.ts`.

- [ ] **Step 1: Create the shared constant**

Create `src/lib/venue.ts`:

```ts
// Physical ticket pickup / pay-in-person location for KİNDZİ FEST. Single source
// of truth so the address is written once and reused across the gate-pass email,
// the ticket page, and the pay-page confirmation.
export const MOTTO_PICKUP =
  "Motto — Mustafakemalpaşa, Motto Sokak No:12, 52400 Fatsa/Ordu, Türkiye";
```

- [ ] **Step 2: Write the failing email-copy test**

In `src/lib/notify/types.test.ts`, add an import `import { MOTTO_PICKUP } from "../venue";` and add a new assertion inside the existing `describe("buildGatePassEmail", …)` block (or as a new `it`):

```ts
  it("offers the Motto pickup address in addition to paying at the gate", () => {
    const msg = buildGatePassEmail({
      eventName: "KİNDZİ FEST",
      name: "Ali",
      ticketsUrl: "https://x/tickets/tok-1",
    });
    expect(msg.text).toContain(MOTTO_PICKUP);
  });
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/lib/notify/types.test.ts`
Expected: FAIL — body does not yet contain the Motto address.

- [ ] **Step 4: Add the Motto line to `buildGatePassEmail`**

In `src/lib/notify/types.ts`, add `import { MOTTO_PICKUP } from "../venue";` at the top, then extend the `buildGatePassEmail` body string. The function currently returns:

```ts
export function buildGatePassEmail(p: { eventName: string; name: string; ticketsUrl: string }): EmailMessage {
  return {
    subject: `${p.eventName} QR biletiniz hazır — ödeme girişte`,
    text:
      `Merhaba ${p.name},\n\n` +
      `${p.eventName} için QR biletiniz hazır ve bu e-postaya PDF olarak eklenmiştir.\n` +
      `ÖNEMLİ: Bilet ücretini girişte ödeyeceksiniz; ödemeniz henüz alınmadı.\n` +
      `Biletinizi çevrimiçi görüntülemek için:\n${p.ticketsUrl}\n\n` +
      `Girişte bu biletteki karekodu okutup ödemenizi yapmanız yeterlidir. Etkinlikte görüşmek üzere!`,
  };
}
```

Insert a Motto line after the "ÖNEMLİ" line, so the body reads:

```ts
    text:
      `Merhaba ${p.name},\n\n` +
      `${p.eventName} için QR biletiniz hazır ve bu e-postaya PDF olarak eklenmiştir.\n` +
      `ÖNEMLİ: Bilet ücretini girişte ödeyeceksiniz; ödemeniz henüz alınmadı.\n` +
      `Dilerseniz fiziksel biletinizi şu adresten de alabilirsiniz: ${MOTTO_PICKUP}\n` +
      `Biletinizi çevrimiçi görüntülemek için:\n${p.ticketsUrl}\n\n` +
      `Girişte bu biletteki karekodu okutup ödemenizi yapmanız yeterlidir. Etkinlikte görüşmek üzere!`,
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/lib/notify/types.test.ts src/lib/notify/dispatch.test.ts`
Expected: PASS (new Motto assertion plus all existing email/dispatch tests still green).

- [ ] **Step 6: Commit**

```bash
git add src/lib/venue.ts src/lib/notify/types.ts src/lib/notify/types.test.ts
git commit -m "feat(notify): add Motto pickup address to the gate-pass email

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Pay-in-person action + pay/ticket page copy + admin badge

**Files:**
- Create: `src/app/pay/[token]/actions.ts` (`requestPayInPersonAction`)
- Modify: `src/app/pay/[token]/page.tsx` (button + confirmation panel + Motto note in `hasDoorPass`)
- Modify: `src/app/tickets/[token]/page.tsx` (Motto/pay-at-gate note when unpaid)
- Modify: `src/app/admin/page.tsx` (`Şahsen ödeme istedi` badge in the APPROVED branch)

**Interfaces:**
- Consumes: `requestPayInPerson` (Task 1), `MOTTO_PICKUP` (Task 2), and the existing `loadTicketsByAccessToken` view (carries `application`).

> No automated DOM tests (consistent with the base feature). Verification is `tsc` + `npm run build` + the manual checklist in Step 6.

- [ ] **Step 1: Read the Next.js docs, then create the public action**

Per `AGENTS.md`, read the server-actions guide under `node_modules/next/dist/docs/`. Then create `src/app/pay/[token]/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { requestPayInPerson } from "@/lib/applications";

// Public (NOT admin-gated): an approved guest signals they will pay in person.
// requestPayInPerson only sets a flag on a valid APPROVED pay token and is a
// silent no-op otherwise, so this action cannot issue tickets, record payment,
// or disclose data.
export async function requestPayInPersonAction(formData: FormData) {
  const token = String(formData.get("token"));
  await requestPayInPerson(token);
  revalidatePath(`/pay/${token}`);
}
```

- [ ] **Step 2: Pay page — button, confirmation, and Motto note**

In `src/app/pay/[token]/page.tsx`:

(a) Add imports at the top:

```ts
import { MOTTO_PICKUP } from "@/lib/venue";
import { requestPayInPersonAction } from "./actions";
```

(b) In the `hasDoorPass` branch (the "Biletleriniz hazır" block), add the Motto note inside the existing info box, after the "Ödemeyi ({amount} TL) kapıda alacağız." paragraph:

```tsx
          <p className="mt-3 text-sm leading-relaxed text-moss/80">
            Dilerseniz fiziksel biletinizi şu adresten de alabilirsiniz: {MOTTO_PICKUP}
          </p>
```

(c) In the bottom normal-payment view (the final `return (<Shell> … </Shell>)`), add the pay-in-person button after the Havale button (after the `</a>` that closes "Havale / EFT ile öde", before the legal-text `<p>`):

```tsx
      <form action={requestPayInPersonAction}>
        <input type="hidden" name="token" value={token} />
        <button
          className="mt-3 inline-block w-full rounded-sm border border-ink/20 px-6 py-3.5 text-sm font-medium uppercase tracking-[0.18em] text-ink transition-all duration-300 hover:bg-ink/5"
        >
          Şahsen ödemek istiyorum
        </button>
      </form>
```

(d) Still in the bottom view, render a confirmation panel when the guest has already requested. The page loads `app`; `app.payInPersonRequestedAt` is available. Insert this ABOVE the price box (right after the `<h1>Ödeme</h1>`):

```tsx
      {app.payInPersonRequestedAt && (
        <div className="mt-6 rounded-sm border border-hazel/30 bg-mist p-5 text-left">
          <p className="leading-relaxed text-moss">
            Talebiniz alındı; organizatör biletinizi en kısa sürede gönderecek.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-moss/80">
            Ödemeyi girişte yapabilir ya da fiziksel biletinizi şu adresten
            alabilirsiniz: {MOTTO_PICKUP}
          </p>
        </div>
      )}
```

(Leave the existing online/Havale buttons in place — they stay available per the spec.)

- [ ] **Step 3: Tickets page — Motto/pay-at-gate note when unpaid**

In `src/app/tickets/[token]/page.tsx`, add `import { MOTTO_PICKUP } from "@/lib/venue";`. The `view` for `kind === "valid"` carries `application`. In the final `return`, after the intro paragraph and before `<TicketList …>`, add a note shown only when the booking is unpaid (a gate pass):

```tsx
      {view.application.paidAt == null && (
        <div className="mt-4 rounded-sm border border-hazel/30 bg-mist p-4 text-left">
          <p className="text-sm leading-relaxed text-moss">
            Ödemeyi girişte yapacaksınız. Dilerseniz fiziksel biletinizi şu
            adresten de alabilirsiniz: {MOTTO_PICKUP}
          </p>
        </div>
      )}
```

(When the booking is PAID, `paidAt` is set, so no payment note shows.)

- [ ] **Step 4: Admin badge for a pending pay-in-person request**

In `src/app/admin/page.tsx`, in the `ApplicationActions` component's `a.status === "APPROVED" && a.payToken` block, add a badge at the START of that fragment (before the existing CopyLink), shown only when a request is pending and no pass issued yet:

```tsx
          {a.payInPersonRequestedAt && a.ticketsAccessToken == null && (
            <span className="rounded-full bg-moss/10 px-2.5 py-0.5 text-xs font-medium text-moss">
              Şahsen ödeme istedi
            </span>
          )}
```

(The admin list query already selects the full `Application`, so `a.payInPersonRequestedAt` is available with no query change. Leave PENDING/PAID branches and `hasActions` unchanged.)

- [ ] **Step 5: Typecheck, build, and run the suite**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npx vitest run`
Expected: full suite PASS (no regressions; this task adds no new tests).

Run: `npm run build`
Expected: build succeeds (pay, tickets, admin routes compile).

- [ ] **Step 6: Manual verification**

Start `npm run dev`, then with a test booking:

1. Approve a booking. Open its pay link → the normal payment view shows a **"Şahsen ödemek istiyorum"** button alongside Havale (and online if enabled).
2. Tap it → a confirmation panel appears ("Talebiniz alındı…") with the Motto address, and the Havale/online buttons are still present.
3. In `/admin`, the booking's APPROVED row shows the **"Şahsen ödeme istedi"** badge.
4. Tap **"Kapıda öde bileti ver"** → the badge disappears, the bilet-link/revoke pair shows, and the gate-pass email (console notifier in dev) contains the Motto address.
5. Open `/tickets/<accessToken>` for that unpaid pass → the Motto/pay-at-gate note shows. For a PAID booking, the note is absent.

- [ ] **Step 7: Commit**

```bash
git add src/app/pay/[token]/actions.ts src/app/pay/[token]/page.tsx src/app/tickets/[token]/page.tsx src/app/admin/page.tsx
git commit -m "feat(pay): pay-in-person request button, admin badge, Motto pickup note

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage (addendum):**
- `payInPersonRequestedAt` field + migration → Task 1. ✓
- `requestPayInPerson` lib (guarded, idempotent, silent no-op) + tests → Task 1. ✓
- `MOTTO_PICKUP` shared constant → Task 2. ✓
- Motto in gate-pass email + test → Task 2. ✓
- Public `requestPayInPersonAction` → Task 3 Step 1. ✓
- Pay page button + confirmation + Motto note (hasDoorPass) → Task 3 Step 2. ✓
- Ticket page Motto note gated on unpaid → Task 3 Step 3. ✓
- Admin `Şahsen ödeme istedi` badge → Task 3 Step 4. ✓
- Other payment options kept available → Task 3 Step 2(c)/(d) leave them in place. ✓

**Placeholder scan:** No TBD/TODO; every code step has complete code and exact commands. ✓

**Type consistency:** `requestPayInPerson(payToken: string): Promise<void>` is consumed by `requestPayInPersonAction` (reads `token` from formData, awaits, no return use) → matches. `MOTTO_PICKUP` is a `string` used in template literals in email + both pages → matches. `view.application.paidAt` (on the `valid` TicketsView) gates the ticket-page note → matches the existing `loadTicketsByAccessToken` return shape. `app.payInPersonRequestedAt` on the pay page and admin list come from the full `Application` selected by both queries → matches the new schema field. ✓
