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

## Core insight

The easy part is the form and the review screen. The hard part is taking real money
online in Turkey legally. The design therefore **separates the gate (custom) from
the money (outsourced)**:

- We build: application intake, manual approval, and the approve → pay → confirm
  state machine.
- iyzico handles: the card form, PCI scope, the funds, and invoicing — all under the
  **commissioner's** merchant account. We never touch card data or hold funds.

## Approach (chosen)

**A — Build the gate, buy the money.** Custom app for application + approval; payment
via **automated iyzico hosted checkout** (Checkout Form). Commissioner is merchant of
record. Rejected alternatives: full custom payment integration (too much liability for
a one-off), and a no-code forms+spreadsheet stitch (error-prone at 200 applicants).

## End-to-end flow

```
Applicant fills public form ──> status: PENDING
        │
        ▼
Commissioner reviews (name, email, social tags)
        │
   approve ──> APPROVED ──> email unique, expiring payment link
        │
   reject  ──> REJECTED ──> optional polite email
        │
Applicant clicks link ──> iyzico hosted card page (we never see card data)
        │
   payment ok ──> iyzico server callback/webhook ──> PAID ──> confirmation email
        │
Door: staff open "Paid attendees" list + check ID (informal entry, no QR scanning)
```

## State machine

States: `PENDING → APPROVED → PAID`, with `PENDING/APPROVED → REJECTED` as a
side exit.

| From | Event | To | Guard |
|------|-------|----|-------|
| (none) | form submitted | PENDING | valid input, rate limit ok |
| PENDING | admin approves | APPROVED | issues fresh payToken + expiry |
| PENDING/APPROVED | admin rejects | REJECTED | — |
| APPROVED | valid payment callback | PAID | token valid, not expired, capacity not exceeded |
| APPROVED | token expires | APPROVED (link dead) | re-approve to reissue token |

Illegal transitions (e.g. paying while PENDING, paying twice) must be rejected.

## Data model

`Application`
- `id`, `createdAt`
- `name`, `email`
- `socialTags` (instagram / x / other — stored so the commissioner can vet)
- `status` — PENDING | APPROVED | REJECTED | PAID
- `payToken` — random unguessable string for the personal payment URL (null until approved)
- `payTokenExpiresAt` — link expiry (default 72h)
- `iyzicoRef`, `paidAt` — set on confirmed payment
- `reviewNote` — optional admin note

`AdminUser` — single commissioner login (email + password hash).

Optional `Settings` row (or env): ticket price, currency (TRY), capacity cap, event name.

## Security & edge cases

These are where gated-payment systems fail; each is a requirement:

1. **Only approved can pay** — checkout is only created if the token maps to an
   APPROVED record and is not expired. Unknown/expired token → no checkout.
2. **Trust the server, not the redirect** — payment is confirmed via iyzico's
   **server-side callback/webhook**, never by the user landing on a success page.
   This is the single most important rule.
3. **No double-charge / no link resale** — once PAID, the link shows "already paid"
   and creates no new checkout.
4. **Capacity cap** — optional max PAID count to avoid overselling the venue.
5. **Public-form abuse** — rate limiting + honeypot field (form is public).
6. **KVKK/GDPR** — storing names, emails, social handles requires a consent line at
   submission and a retention plan (delete personal data after the event). Relevant
   in Turkey (KVKK).
7. **Token secrecy** — payTokens are long random values, single-purpose, expiring.

## Commissioner's homework (legal, not our build)

- Confirm with their accountant that the existing business entity can sell **event
  tickets online** (card-not-present), distinct from in-restaurant POS.
- Ensure an **iyzico merchant account** is set up under that entity.
- Confirm **e-Arşiv fatura** issuance for ticket sales and **KDV (VAT)** handling —
  iyzico/their accountant covers this; not our code.

## Stack

Reuse the developer's proven stack to minimize risk on a paid commission:

- **Next.js** (App Router) — public form, admin screens, API routes for iyzico
  callbacks.
- **Prisma** — ORM; Postgres in production (SQLite acceptable for local/dev).
- **iyzico** — hosted Checkout Form for payment; commissioner is merchant of record.
- **iron-session** — admin authentication.
- **Zod** — input validation on the public form and admin actions.
- Email via a transactional provider (e.g. Resend) for approval/confirmation mails.
- Hosting: Vercel + managed Postgres.

## Components / boundaries

- **Public application form** — collects + validates input, creates PENDING record.
- **Admin dashboard** — auth-gated list with filters by status; approve/reject
  actions; export "Paid attendees" list for the door.
- **Payment service** — given an APPROVED application, creates an iyzico checkout
  session; verifies callbacks; flips to PAID.
- **Notifier** — sends approval (with link), rejection, and payment-confirmation
  emails.
- **State machine** — single module owning all legal transitions, unit-tested in
  isolation.

## Testing

- Unit-test the state machine: cannot pay when PENDING, token expiry blocks payment,
  no double-pay, capacity cap enforced.
- Mock the iyzico callback to assert PAID only flips on a valid, signed server
  callback — never on the browser redirect alone.
- Validation tests for the public form (bad email, missing fields, honeypot tripped).

## Out of scope (YAGNI for a one-off)

- QR tickets / door scanning (entry is an informal name+ID check).
- Multiple ticket tiers, discount codes, waitlists.
- Self-serve refunds (handle the rare refund manually via iyzico).
- Multi-event / multi-organizer reuse (single event only).
