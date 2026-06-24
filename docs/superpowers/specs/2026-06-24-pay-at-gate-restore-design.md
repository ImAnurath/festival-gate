# Pay at the Gate — Restore (admin-issued unpaid QR pass)

**Date:** 2026-06-24
**Status:** Approved, ready for implementation plan

## Summary

Restore "Kapıda öde" (pay at the gate): an admin issues a QR ticket to an
**APPROVED but unpaid** booking. The guest receives their QR by email now and
pays at the gate on arrival, where the scanner collects payment and checks them
in.

This functionality existed previously via a self-service `pay/[token]/door-pass`
route (removed in commit `8ed4a81`, after being replaced by the Havale/EFT page).
We are bringing it back, but **admin-controlled per booking** rather than
self-service, mirroring the existing Havale confirm/undo button pair.

## Background: what already exists

The gate side is fully built and is **not changed** by this work:

- `issueTickets(db, app)` (`src/lib/tickets.ts:58`) issues one QR ticket per
  attendee and stamps `ticketsAccessToken`. It is **idempotent** — if the token
  is already set it returns the existing tickets and creates nothing. It does not
  require the application to be PAID.
- `scanTicket(identifier)` (`src/lib/tickets.ts:151`) already detects a QR whose
  application is APPROVED (unpaid) and returns an `unpaid` result carrying the
  group amount and quantity for the door-collection UI.
- `markPaidAtDoor(id)` / `collectAtDoorAndCheckIn(applicationId, identifier)`
  (`src/lib/applications.ts:95`, `:186`) mark the booking PAID with
  `paymentRef: "door-pos"` and check the scanned ticket in.
- `undoDoorPayment` and `searchAttendeeApplications` already account for
  "APPROVED guests who hold tickets while unpaid" — the data model anticipates
  this state.

The **only** missing piece is the trigger that hands an approved guest their QR
before payment. That is what this spec adds.

## Data model

**No schema or migration changes.** The `Status` enum
(`PENDING | APPROVED | REJECTED | PAID`) and all relevant fields
(`ticketsAccessToken`, `ticketsDeliveredAt`, `paidAt`, `paymentRef`, `amount`,
`Ticket.status`) already exist. A gate-pass booking is simply an `APPROVED`
application that has a `ticketsAccessToken` and `Ticket` rows but
`paidAt == null` / `paymentRef == null`.

## Components

### 1. `src/lib/applications.ts` — two new functions

**`issueGatePass(id)`**
- Runs in a transaction. Loads the application; throws `TransitionError` if
  `status !== "APPROVED"`.
- Calls the existing `issueTickets(tx, app)` (idempotent — a double tap returns
  the existing tickets, creates nothing).
- Does **not** set `paidAt`, `paymentRef`, or `amount`; the booking stays
  `APPROVED` / unpaid.
- Returns the application with `tickets` included (for the dispatch step).

**`revokeGatePass(id)`**
- Runs in a transaction. Loads the application.
- Throws `NotPayableError` if `status !== "APPROVED"` or `paidAt != null`
  (never touch a paid booking).
- Throws `NotPayableError` if **any** of its tickets is already `USED` (the guest
  has checked in — revoking would strand them).
- Otherwise deletes the application's `Ticket` rows and clears
  `ticketsAccessToken` and `ticketsDeliveredAt`, returning the booking to
  approved / no-pass.
- Returns the updated application.

### 2. `src/lib/notify/types.ts` + `src/lib/notify/dispatch.ts` — gate email

**`buildGatePassEmail({ eventName, name, ticketsUrl })`** in `types.ts`
- Turkish copy making clear the QR is ready **and payment is due at the gate**,
  e.g. subject/body around "QR biletiniz hazır — ödemeyi girişte yapacaksınız".
- Same shape as `buildTicketsEmail` (subject + html/text), so it composes with the
  PDF attachment in dispatch.

**`dispatchGatePass(app, tickets)`** in `dispatch.ts`
- Structurally identical to `dispatchTickets`: guards on `ticketsAccessToken`,
  emails `buildGatePassEmail` with the tickets PDF attached, best-effort
  (a send failure logs and never undoes issuance).
- WhatsApp channel reuses the existing `sendTicketsLink` retrieval link.
  Gate-specific WhatsApp copy is **optional polish**, not required for v1; if
  skipped, the retrieval link still reaches the guest.

### 3. `src/app/admin/actions.ts` — two new server actions

**`giveGatePassAction(formData)`**
- `requireAdmin()`, read `id`, call `issueGatePass(id)`, then
  `dispatchGatePass(app, app.tickets)`, then `revalidatePath("/admin")`.

**`revokeGatePassAction(formData)`**
- `requireAdmin()`, read `id`, call `revokeGatePass(id)`, then
  `revalidatePath("/admin")`.

Both let lib-layer errors surface, consistent with `confirmHavaleAction` /
`undoHavaleAction` today.

### 4. `src/app/admin/page.tsx` — buttons in `ApplicationActions`

The admin list query already loads the full `Application`, so
`a.ticketsAccessToken` is available per row — no query change needed.

- In the existing `a.status === "APPROVED"` branch:
  - When `a.ticketsAccessToken == null` (no pass yet): add a primary
    **"Kapıda öde bileti ver"** button wired to `giveGatePassAction`.
  - When `a.ticketsAccessToken != null` (pass issued, still APPROVED/unpaid): show
    a **"Bilet bağlantısı"** `CopyLink` to `/tickets/{ticketsAccessToken}` and a
    secondary **"Bileti iptal et"** button wired to `revokeGatePassAction`.
- Update `hasActions(a)` so the mobile card shows its action divider for an
  APPROVED booking that has a `ticketsAccessToken`.
- Buttons are rendered by the shared `ApplicationActions` component, so desktop
  table and mobile cards stay in sync automatically.

## Data flow

1. Admin opens `/admin`, taps **"Kapıda öde bileti ver"** on an APPROVED booking.
2. `issueGatePass` creates the QR tickets; the booking stays `APPROVED` (unpaid).
3. `dispatchGatePass` emails the QR + PDF with "pay at the gate" wording (and the
   WhatsApp retrieval link when a phone is present).
4. Guest arrives; staff scan the QR. `scanTicket` returns the `unpaid` result with
   the amount due.
5. Staff collect cash/POS; `collectAtDoorAndCheckIn` marks the booking PAID
   (`paymentRef: "door-pos"`) and checks the ticket in. Other group members'
   tickets scan straight through (the application is now PAID).

If the admin issued the pass by mistake, **"Bileti iptal et"** revokes it (so long
as no ticket has been used yet).

## Error handling

- `issueGatePass` and `revokeGatePass` use guarded transactions and throw
  `TransitionError` / `NotPayableError`, consistent with the neighbouring
  `markPaidByHavale` / `undoHavalePayment` functions.
- `issueTickets` idempotency means a double tap on "give pass" is a no-op.
- `revokeGatePass` refusing on a `USED` ticket prevents stranding a guest who has
  already checked in.
- Notification dispatch is best-effort; a send failure never undoes issuance (the
  admin can re-tap, which is idempotent, or use the copy-link fallback).

## Testing

Unit tests mirroring the existing Havale tests:

- `issueGatePass`: issues tickets for an APPROVED booking; stays APPROVED with
  `paidAt == null`; idempotent on re-tap (no duplicate tickets); throws on a
  non-APPROVED booking.
- `revokeGatePass`: deletes tickets and clears `ticketsAccessToken`; refuses when
  any ticket is `USED`; refuses when the booking is `PAID`.
- `ApplicationActions` render test: APPROVED + no token shows "Kapıda öde bileti
  ver"; APPROVED + token shows the bilet link + "Bileti iptal et"; PAID branch
  unchanged.

## Out of scope (YAGNI)

- No self-service "pay at the gate" button on the public pay page.
- No auto-issue at approval time.
- No new payment state in the `Status` enum.
- No changes to the scanner / door-collection code (already supports this).
- Gate-specific WhatsApp copy (retrieval link reused; copy is optional polish).

## Implementation notes

- Per `AGENTS.md`, this Next.js version has breaking changes; consult
  `node_modules/next/dist/docs/` before writing route/server-action code.
- Create a dedicated branch for the work (current branch is
  `harden/login-ratelimit-trusted-ip`).
