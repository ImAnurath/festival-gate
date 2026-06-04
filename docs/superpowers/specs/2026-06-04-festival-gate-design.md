# Festival Gate — Approval-Gated Ticket Sales

**Date:** 2026-06-04
**Status:** Approved design (pre-implementation)
**Type:** One-off commission, single festival event (~150–200 expected applicants)

## Problem

A commissioner is running a one-off festival and wants to sell tickets, but with a
twist: they want to **manually vet each prospective buyer** before allowing a
purchase. Applicants submit their name, email, and public social media handles. The
commissioner reviews each one and decides whether to "allow" them to buy. Only
approved people may pay. This happens in Turkey, with real money and online card
sales, so legal/payment/invoicing concerns are real.

**The gate is per-buyer, not per-ticket.** The vetting exists to "smoke out" bad
actors, so we vet the *person*. A trusted approved buyer vouches for their own party
and may buy multiple tickets (e.g. for a partner and children) — a common Turkish
family-outing pattern. So one approved application can cover several tickets.

## Core insight

The easy part is the form and the review screen. The hard part is taking real money
online in Turkey legally. The design therefore **separates the gate (custom) from
the money (outsourced)**:

- We build: application intake, manual approval, and the approve → pay → confirm
  state machine.
- The payment step sits behind a **pluggable provider interface**. We ship a **Stub
  provider first** (marks an approved buyer as paid, so the whole flow is tangible and
  demoable without any merchant account), then drop in iyzico later as a swap.
- iyzico (later) handles: the card form, PCI scope, the funds, and invoicing — all
  under the **commissioner's** merchant account. We never touch card data or hold
  funds.

## Approach (chosen)

**A — Build the gate, buy the money.** Custom app for application + approval; payment
behind a provider interface — a **Stub provider for the first tangible build**, with
**automated iyzico hosted checkout** (Checkout Form) dropped in later. Commissioner is
merchant of record. Rejected alternatives: full custom payment integration (too much
liability for a one-off), and a no-code forms+spreadsheet stitch (error-prone at 200
applicants).

## End-to-end flow

```
Applicant fills public form ──> status: PENDING
  (name, email, social tags, ticket quantity, guest first names)
        │
        ▼
Commissioner reviews the whole party (buyer + guests)
        │
   approve ──> APPROVED ──> email unique, expiring payment link
        │
   reject  ──> REJECTED ──> optional polite email
        │
Applicant clicks link ──> payment page for (quantity × price)
        │                    Stub provider now / iyzico hosted card page later
        │
   payment ok ──> server callback ──> PAID ──> confirmation email
        │
Door: staff open "Paid attendees" list, check buyer ID + their named guests
       (informal entry, no QR scanning)
```

## State machine

States: `PENDING → APPROVED → PAID`, with `PENDING/APPROVED → REJECTED` as a
side exit.

| From | Event | To | Guard |
|------|-------|----|-------|
| (none) | form submitted | PENDING | valid input, rate limit ok |
| PENDING | admin approves | APPROVED | issues fresh payToken + expiry |
| PENDING/APPROVED | admin rejects | REJECTED | — |
| APPROVED | valid payment callback | PAID | token valid, not expired |
| APPROVED | token expires | APPROVED (link dead) | re-approve to reissue token |

Illegal transitions (e.g. paying while PENDING, paying twice) must be rejected.

## Data model

`Application` (one row = one buyer + their party)
- `id`, `createdAt`
- `name`, `email` (the vetted buyer)
- `socialTags` (instagram / x / other — stored so the commissioner can vet)
- `ticketQuantity` — total tickets incl. the buyer (1 … MAX_TICKETS_PER_BUYER)
- `guestNames` — first names of accompanying guests (length = ticketQuantity − 1)
- `status` — PENDING | APPROVED | REJECTED | PAID
- `payToken` — random unguessable string for the personal payment URL (null until approved)
- `payTokenExpiresAt` — link expiry (default 72h)
- `amount` — `ticketQuantity × unit price`, captured at payment time
- `paymentRef`, `paidAt` — set on confirmed payment (provider-agnostic reference)
- `reviewNote` — optional admin note

`AdminUser` — single commissioner login (email + password hash).

Config (env or a `Settings` row): `EVENT_NAME`, `TICKET_PRICE` (TRY),
`MAX_TICKETS_PER_BUYER` (default 6), `PAY_TOKEN_TTL_HOURS` (default 72),
`PAYMENT_PROVIDER` (`stub` | `iyzico`). No event-wide capacity cap (not needed).

## Security & edge cases

These are where gated-payment systems fail; each is a requirement:

1. **Only approved can pay** — checkout is only created if the token maps to an
   APPROVED record and is not expired. Unknown/expired token → no checkout.
2. **Trust the server, not the redirect** — payment is confirmed via iyzico's
   **server-side callback/webhook**, never by the user landing on a success page.
   This is the single most important rule.
3. **No double-charge / no link resale** — once PAID, the link shows "already paid"
   and creates no new checkout.
4. **Quantity bounds** — `ticketQuantity` validated to 1 … MAX_TICKETS_PER_BUYER
   server-side; `guestNames` length must equal `ticketQuantity − 1`. Prevents one
   approval from being used to buy an unbounded number of tickets.
5. **Public-form abuse** — rate limiting + honeypot field (form is public).
6. **KVKK/GDPR** — storing names, emails, social handles, and **guest first names**
   requires a consent line at submission (the buyer confirms their guests consent to
   their names being recorded for entry) and a retention plan (delete personal data
   after the event). Relevant in Turkey (KVKK).
7. **Token secrecy** — payTokens are long random values, single-purpose, expiring.

## Commissioner's homework (legal, not our build)

- Confirm with their accountant that the existing business entity can sell **event
  tickets online** (card-not-present), distinct from in-restaurant POS.
- Ensure an **iyzico merchant account** is set up under that entity.
- Confirm **e-Arşiv fatura** issuance for ticket sales and **KDV (VAT)** handling —
  iyzico/their accountant covers this; not our code.

## Stack

Reuse the developer's proven stack to minimize risk on a paid commission:

- **Next.js** (App Router) — public form, admin screens, API routes for payment
  callbacks.
- **Prisma** — ORM; Postgres in production (SQLite acceptable for local/dev).
- **Payment provider interface** — `Stub` implementation first (no merchant account
  needed; marks the buyer paid for `quantity × price`), `iyzico` hosted Checkout Form
  added later as a drop-in. Commissioner is merchant of record under iyzico.
- **iron-session** — admin authentication.
- **Zod** — input validation on the public form and admin actions.
- Email via a transactional provider (Resend) for approval/confirmation mails.
- Hosting: Vercel + managed Postgres.

## Components / boundaries

- **Public application form** — collects + validates buyer info, ticket quantity, and
  guest first names; creates PENDING record.
- **Admin dashboard** — auth-gated list with filters by status; approve/reject
  actions; shows the full party (buyer + guests + quantity); export "Paid attendees"
  list (buyer ID + named guests) for the door.
- **Payment provider interface** — `createCheckout(application)` and
  `verifyCallback(payload)`; given an APPROVED application creates a checkout for
  `quantity × price` and flips to PAID on a verified callback. `Stub` now, `iyzico`
  later — the rest of the app depends only on the interface.
- **Notifier** — sends approval (with link), rejection, and payment-confirmation
  emails.
- **State machine** — single module owning all legal transitions, unit-tested in
  isolation.

## Testing

- Unit-test the state machine: cannot pay when PENDING, token expiry blocks payment,
  no double-pay.
- Test quantity rules: quantity outside 1 … MAX rejected; `guestNames` length must
  equal `quantity − 1`; amount computed as `quantity × price`.
- Test against the payment provider interface with the Stub; mock a provider callback
  to assert PAID only flips on a verified server callback — never on the browser
  redirect alone (the rule that matters most once iyzico is wired in).
- Validation tests for the public form (bad email, missing fields, honeypot tripped).

## Out of scope (YAGNI for a one-off)

- Event-wide capacity cap (no venue limit to enforce; only a per-buyer ticket max).
- QR tickets / door scanning (entry is an informal name+ID check).
- Multiple ticket tiers, discount codes, waitlists.
- Self-serve refunds (handle the rare refund manually via iyzico).
- Multi-event / multi-organizer reuse (single event only).
