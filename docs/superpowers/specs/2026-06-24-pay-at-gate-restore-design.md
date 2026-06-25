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

---

# Addendum (2026-06-25): guest "pay in person" request + Motto pickup address

The base feature above is implemented and merged onto branch
`feat/pay-at-gate-restore` (commits 07fba8e, e10ee31, 40865cc, 6a06b0b). This
addendum adds two things on top, both approved:

1. A guest-initiated "Şahsen ödemek istiyorum" (I want to pay in person) button
   on the pay page that signals the admin, who then issues the gate pass with the
   existing button.
2. Tell guests they can buy a physical ticket at Motto, in addition to paying at
   the gate.

## Decisions (from brainstorming)

- **Admin signal:** dashboard badge only — no admin email/notification plumbing.
- **Other payment options after the request:** kept available (Havale/EFT, and
  online when enabled) so the guest can still change their mind and pay now.
- **Motto note placement:** gate-pass email + `/tickets/[token]` page + the
  pay-in-person confirmation panel (and the pay page `hasDoorPass` branch, which
  is the same gate-pass surface a guest sees).

## Schema

Add ONE nullable field to `Application`:

```prisma
payInPersonRequestedAt DateTime?
```

Requires a Prisma migration. Independent of `ticketsAccessToken` (the admin
fulfilling the request by issuing the pass).

## Motto pickup address (request 1)

- Define the address ONCE as a shared constant so it is written in a single
  place, e.g. in a small module `src/lib/venue.ts`:
  `export const MOTTO_PICKUP = "Motto — Mustafakemalpaşa, Motto Sokak No:12, 52400 Fatsa/Ordu, Türkiye";`
- **`buildGatePassEmail`** (`src/lib/notify/types.ts`): add a line offering the
  Motto pickup in addition to paying at the gate. (Note: `types.ts` is a pure
  module; import the constant from `venue.ts`, keep it free of server-only deps.)
- **`/tickets/[token]` page** (`src/app/tickets/[token]/page.tsx`): the view
  already carries `application`. When the booking is **unpaid** (gate pass —
  `application.paidAt == null` / status not PAID), show a note: pay at the gate
  or buy a physical ticket at Motto: `MOTTO_PICKUP`. When PAID, show nothing
  extra.
- **Pay page** (`src/app/pay/[token]/page.tsx`): the `hasDoorPass` branch and the
  new pay-in-person confirmation panel both show the same Motto note.

## "I want to pay in person" (request 2)

- **Lib** (`src/lib/applications.ts`): `requestPayInPerson(payToken: string)` —
  guarded `updateMany` on `status === "APPROVED"` stamping `payInPersonRequestedAt`
  only when currently null. Idempotent; never touches payment/ticket fields. A
  request on a non-APPROVED / unknown token is a silent no-op (returns without
  throwing) so a stale tab can't error the page.
- **Public server action** `requestPayInPersonAction(formData)` in
  `src/app/pay/[token]/actions.ts` (NEW file, `"use server"`). NOT admin-gated:
  it only sets a flag on a valid pay token, cannot issue tickets or record
  payment. Reads `token` from the form, calls `requestPayInPerson`,
  `revalidatePath` the pay page.
- **Pay page normal view** (the bottom branch, no pass yet): add a
  **"Şahsen ödemek istiyorum"** button (a `<form action={requestPayInPersonAction}>`
  with the token in a hidden input) below the Havale/online buttons.
- **After the request** (`payInPersonRequestedAt != null` and still no pass): the
  same bottom view additionally renders a confirmation panel —
  "Talebiniz alındı; organizatör biletinizi en kısa sürede gönderecek." + the
  Motto note + a pay-at-gate note — WHILE keeping the Havale/online buttons.
- **Admin dashboard** (`src/app/admin/page.tsx`): in the APPROVED branch, when
  `a.payInPersonRequestedAt != null && a.ticketsAccessToken == null`, show a badge
  **"Şahsen ödeme istedi"** next to the actions so the admin knows to issue the
  pass. After issuance (`ticketsAccessToken != null`) the badge is gone and the
  bilet-link/revoke pair shows (existing behavior). The admin list query already
  selects the whole `Application`, so the new field is available with no query
  change.

## Flow

Guest opens pay link → taps "Şahsen ödemek istiyorum" → confirmation + Motto/gate
info (other options still available) → admin sees the "Şahsen ödeme istedi" badge
in `/admin` → taps "Kapıda öde bileti ver" → guest receives the QR email (now with
the Motto line) → pays at the gate or buys the physical ticket at Motto.

## Error handling / safety

- `requestPayInPerson` is a guarded, idempotent no-op when not APPROVED; the
  public action cannot escalate (no ticket issuance, no payment, no PII exposure).
- Setting the flag does not change `Status`; the booking stays APPROVED until the
  admin issues the pass (existing `issueGatePass`).
- The Motto note on the ticket page is gated on unpaid state so a PAID guest is
  never told to "pay at the gate".

## Testing (addendum)

- `requestPayInPerson`: stamps `payInPersonRequestedAt` on an APPROVED booking;
  idempotent (second call keeps the first timestamp); silent no-op on a
  non-APPROVED / unknown token (no throw, no stamp). DB-backed, mirrors the
  existing applications tests.
- `buildGatePassEmail`: body contains the Motto address (extend the existing
  Task 2 test).
- Pages (pay / tickets / admin badge): no automated DOM tests (consistent with
  the base feature); verify via `tsc` + `npm run build` + the manual checklist.

## Out of scope (addendum)

- No admin email/notification on a pay-in-person request (badge only).
- No new `Status` value; `payInPersonRequestedAt` is a flag, not a state.
- No auto-issue on request — the admin still issues the pass.
- Motto address is a static constant, not env-configured (single event, public).
