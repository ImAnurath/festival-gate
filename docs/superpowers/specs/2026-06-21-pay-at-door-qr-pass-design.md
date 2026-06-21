# Pay-at-Door QR Pass — Design

**Date:** 2026-06-21
**Status:** Approved (ready for implementation plan)
**Project:** festival-gate (KİNDZİ FEST)

## Problem

An approved applicant who lands on `/pay/[token]` is only offered **"Şimdi öde"**
(pay online via iyzico). There is no self-serve path to say "I'll pay at the
entrance," and approved-but-unpaid applicants get **no QR**. Today, paying at the
door relies on staff finding the guest **by name** on the `/admin/door` screen
(charge on POS, tap "Ödendi (POS)" → `markPaidAtDoor`, which issues no ticket).

## Goal

A **self-serve door pass**: a "Kapıda öde" button on the pay page issues the
guest a QR pass immediately (while the application stays **unpaid**). At the gate,
staff scan the QR; an unpaid scan shows **"ÖDENMEDİ — collect X TL"**; staff take
payment on the POS and the same flow marks the group paid and checks the scanned
ticket in.

## Decisions (from brainstorming)

- **Core goal:** self-serve door pass (scan-driven door collection), not just a
  pay-page label and not QR-for-everyone-on-approval.
- **Group collection:** collect the **whole application amount once** on the first
  scan; the rest of the group then scans straight through as paid. Matches the
  existing per-application payment model.
- **Approach A — reuse `Application.status` as the source of truth.** Chosen over
  adding a per-ticket `paid` flag (redundant, needs migration) and over a separate
  per-group door-pass QR (forks away from the per-attendee check-in model).

## Invariant change (important)

The codebase currently holds an invariant: **tickets only exist for *paid*
applications.** Two places rely on it:

- `undoDoorPayment` uses "zero tickets" to distinguish a door payment (undoable)
  from an online one (never undo).
- `markPaidAtDoor` is documented as "issues NO tickets."

Approach A **deliberately breaks this invariant**: a door-pass guest has tickets
while still `APPROVED` (unpaid). The mitigation is to stop using ticket-count as a
signal and rely on the existing **`paymentRef === "door-pos"`** marker, which
already reliably distinguishes door payments from online ones.

## Data model

**No schema change.** Payment state stays on `Application.status`
(`PENDING → APPROVED → PAID`, or `REJECTED`). The new "this guest chose
pay-at-door" signal is derived, not stored:

> `status === "APPROVED"` AND `ticketsAccessToken` is set (tickets issued).

Online-paid remains `status === "PAID"`. Door payments remain tagged
`paymentRef === "door-pos"`.

## Components & flow

### 1. Pay page — `/pay/[token]/page.tsx`

New/added states:

- **`APPROVED`, no tickets yet** → current screen: **"Şimdi öde"** (primary) +
  **new "Kapıda öde"** (secondary).
- **Tapping "Kapıda öde"** → POSTs to a new route that issues tickets (reusing the
  idempotent `issueTickets`), stamps `ticketsAccessToken`, and keeps status
  `APPROVED`. The pass is emailed (consistent with the paid path).
- **`APPROVED` + tickets exist (door-pass chosen)** → show the **QR ticket list +
  PDF download**, a banner *"Girişte okutun, ödemeyi kapıda alacağız"*, and **still
  offer "Şimdi öde"** so the guest can pay online instead.
- **`PAID`** → unchanged (existing tickets screen).

Both buttons remain gated by the existing `assertPayable` (APPROVED + non-expired
pay token). Once tickets are issued, the pass is valid through `eventEnd` via
`ticketsAccessToken`, independent of pay-token expiry.

### 2. New route — `pay/[token]/door-pass`

- Validates the application is payable (`assertPayable`).
- Issues tickets via `issueTickets` (idempotent; safe on repeat taps), keeping
  `status === "APPROVED"`.
- Best-effort dispatches the pass (email + PDF), mirroring the paid path's
  `dispatchTickets`. A send failure must not undo issuance.
- Redirects back to `/pay/[token]` (now in the door-pass state).

### 3. Scanner verify — `scan/verify/route.ts` + `lib/tickets.ts`

The scan handler becomes payment-aware. On scan, look up the ticket → its
application and branch:

- **APPROVED (unpaid)** → return
  `{ result: "unpaid", holderName, code, quantity, amount, applicationId }`.
  **Does NOT check in.**
- **PAID + ticket VALID** → one-tap check-in (existing `valid` behavior).
- **ticket USED** → `used` (existing behavior).
- **not found** → `invalid` (existing behavior).

A second endpoint/action **confirms door collection**: given the application id and
the scanned ticket token, it calls `markPaidAtDoor(applicationId)` (marks the whole
group `PAID`, `door-pos`) **then** `checkInTicket(token)` (flips this ticket
`VALID → USED`). Returns the normal `valid` result.

Because mark-paid is per-application, the other group members' QRs subsequently
scan straight to `valid`.

### 4. Scanner UI — `scan/scanner.tsx`

- New `unpaid` result → **blue** full-screen overlay:
  *"ÖDENMEDİ — {amount} TL tahsil et ({quantity} bilet)"*, holder name, and two
  buttons: **"Tahsil edildi"** (confirm → collect + check in) and **"Vazgeç"**
  (dismiss, no change).
- Existing `valid` (green) / `used` (amber) / `invalid` (red) overlays unchanged.
- The auto-dismiss timer must not fire while an unpaid screen awaits a staff
  decision (it requires an explicit tap).

### 5. Door reconciliation — `/admin/door` + `lib/applications.ts`

- The **name-search collection screen stays** as a fallback (lost QR / never
  tapped "Kapıda öde"). Still routes to `markPaidAtDoor`.
- **`undoDoorPayment`:** drop the `ticketCount > 0` guard; gate on
  `paymentRef === "door-pos"`. Undo also **resets any `USED` tickets in the group
  back to `VALID`**, so a mis-collected scan can be fully reverted. Online payments
  (`paymentRef !== "door-pos"`) stay un-undoable.
- A door-pass guest also appears in the screen's `pending` (APPROVED) list —
  harmless; collecting there or via scan both route to `markPaidAtDoor`.

## Edge cases

- **Changed mind → pays online after tapping "Kapıda öde":** the iyzico callback's
  `markPaidByToken` → `issueTickets` is idempotent (returns existing tickets),
  flips to `PAID`, dispatches. Works unchanged.
- **Double-tap "Tahsil edildi":** `markPaidAtDoor`'s guarded `updateMany`
  (`APPROVED`, `paidAt: null`) makes the repeat a no-op; `checkInTicket`'s guarded
  `VALID → USED` handles concurrent scans (exactly one flips the row).
- **Forwarded / screenshotted QR:** no payment bypass — an unpaid scan never admits
  anyone; staff always see "ÖDENMEDİ" and collect first.
- **Pay-token expiry:** gated identically to the online button; the issued pass
  outlives the pay token (valid through `eventEnd`).

## Testing (Vitest, matching existing `*.test.ts`)

- Scanner verify branch: APPROVED+tickets → `unpaid`; PAID+VALID → `valid`;
  USED → `used`; unknown → `invalid`.
- "Kapıda öde" route: issues tickets, keeps `APPROVED`, idempotent on repeat tap.
- Scanner confirm: `markPaidAtDoor` + check-in marks the group `PAID` and the
  scanned ticket `USED`; remaining group tickets then scan `valid`.
- `undoDoorPayment`: new guard reverts a door-pos payment (resetting `USED → VALID`)
  and refuses online payments.

## Files touched

- `src/app/pay/[token]/page.tsx` — door-pass state + "Kapıda öde" button.
- `src/app/pay/[token]/door-pass/route.ts` — **new** issuance route.
- `src/app/admin/scan/verify/route.ts` — unpaid branch + confirm endpoint.
- `src/app/admin/scan/scanner.tsx` — unpaid overlay + confirm/cancel.
- `src/lib/tickets.ts` — payment-aware verify + door-collect confirm helper.
- `src/lib/applications.ts` — `undoDoorPayment` guard swap + USED→VALID reset.

**No migration required.**

## Out of scope

- Per-ticket / partial-group payment (explicitly rejected in favor of
  collect-whole-group-once).
- Any change to the online iyzico payment path beyond reuse.
