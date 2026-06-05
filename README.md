# Festival Gate

Festival Gate is an approval-gated ticketing app for private or invitation-style events. Applicants submit their name, email, and public social handles through a public form. A commissioner then manually reviews each application and either approves or rejects it. Approved buyers receive a unique, time-limited payment link and complete their purchase (currently through a Stub provider that simulates payment; iyzico drops in as a real provider with a small config change). Entry at the door is handled informally: the commissioner exports a CSV of paid attendees and performs a name-plus-ID check. The gate is per-buyer: one approved buyer may purchase multiple tickets for named guests, up to a configurable maximum (default 6 per buyer).

## Tech stack

- **Next.js 16** with the App Router
- **Prisma 7** with PostgreSQL, using the `@prisma/adapter-pg` driver adapter (local Postgres in dev, hosted Postgres in production)
- **iron-session 8** for server-side session management
- **Zod 4** for schema validation
- **Vitest** for unit and integration tests
- **Resend** for transactional email (with a console fallback for development)

These are recent major versions with breaking changes. See `AGENTS.md` for version-specific notes and pitfalls before updating dependencies.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` and set a real `SESSION_PASSWORD` (32 or more random characters). Review the other variables:
   - `EVENT_NAME` - displayed name of the event
   - `TICKET_PRICE` - price per ticket in whole currency units
   - `MAX_TICKETS_PER_BUYER` - maximum tickets one approved buyer may purchase (default 6)
   - `PAY_TOKEN_TTL_HOURS` - how long the payment link remains valid after approval (default 72)
   - `PAYMENT_PROVIDER` - `stub` for development, `iyzico` for production
   - `NOTIFIER` - `console` to log emails to the server terminal, `resend` to send real emails
   - `RESEND_API_KEY` and `MAIL_FROM` - required when `NOTIFIER=resend`
   - `NEXT_PUBLIC_APP_URL` - the public base URL; used when constructing payment links and the callback URL

3. Provision a PostgreSQL database and set `DATABASE_URL` in `.env` to its connection string.
   - **Local:** create an empty database (e.g. with DBeaver, or `createdb festival_gate`), then set `DATABASE_URL="postgresql://USER:PASS@localhost:5432/festival_gate?schema=public"`.
   - **Production:** use a hosted Postgres (Vercel Postgres, Neon, or Supabase) and paste its connection string.

   Then apply the migrations and generate the client:
   ```bash
   npx prisma migrate deploy
   npx prisma generate
   ```
   (`prisma migrate deploy` applies the committed migration in `prisma/migrations`. Use `prisma migrate dev` only when changing the schema.)

4. Create the admin account (uses `DATABASE_URL` from `.env`):
   ```bash
   npx tsx scripts/create-admin.ts admin@example.com "a-strong-password"
   ```
   On Windows, if the variable is not picked up, set it for the session first:
   ```powershell
   $env:DATABASE_URL="postgresql://USER:PASS@localhost:5432/festival_gate?schema=public"
   npx tsx scripts/create-admin.ts admin@example.com "a-strong-password"
   ```

5. Start the development server:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000).

## How it works

Applications move through four states:

| State | Meaning |
|-------|---------|
| `PENDING` | Applicant submitted the public form; awaiting commissioner review |
| `APPROVED` | Commissioner approved; a time-limited pay token was issued and the payment link was emailed to the buyer |
| `REJECTED` | Commissioner rejected; the applicant is notified by email |
| `PAID` | Buyer completed payment; ticket is confirmed; buyer appears on the door list |

`REJECTED` is a one-way exit from `PENDING` only. `PAID` is terminal and cannot be reversed through the UI.

**Public flow:** the applicant visits the root page, fills in the form (name, email, social handles, guests, consent checkbox), and submits. The application is created in `PENDING` state.

**Admin flow:** the commissioner logs in at `/admin/login` and reaches the dashboard at `/admin`. From there they can approve or reject pending applications. Approval generates an expiring pay token and triggers an email containing the unique payment link.

**Payment flow:** the buyer follows the payment link, sees a confirmation page, and pays. The server-side callback (`/api/payment/callback`) verifies the payment and atomically marks the application as `PAID`.

**Door flow:** the commissioner opens `/admin/door` to download or view a CSV of all `PAID` applicants and their guests. Entry is a manual name-plus-ID check against this list.

**Development email:** with `NOTIFIER=console`, all emails (including the pay link) are printed to the server terminal instead of sent. This lets you test the full approval flow without a Resend account.

## Testing

```bash
npm test
```

Vitest runs all unit and integration tests; the test environment variables are injected by `vitest.config.ts`. The pure-logic suites (state machine, validation, payment, CSV, etc.) always run. The DB-backed use-case tests need a PostgreSQL test database: they run when one is reachable and **skip gracefully otherwise**, so `npm test` stays green without a database. To run them, create a test database and point the runner at it:

```bash
createdb festival_gate_test
# DATABASE_URL_TEST overrides the test connection string
DATABASE_URL_TEST="postgresql://USER:PASS@localhost:5432/festival_gate_test?schema=public" npx prisma migrate deploy
DATABASE_URL_TEST="postgresql://USER:PASS@localhost:5432/festival_gate_test?schema=public" npm test
```

With a test database present, all 40 tests run; without one, 33 run and 7 skip.

## Switching to iyzico (production payments)

The payment layer is isolated behind a `PaymentProvider` interface in `src/lib/payment/types.ts`. To add iyzico:

1. Create `src/lib/payment/iyzico.ts` and implement the `PaymentProvider` interface. The two methods are `createCheckout` (generates the checkout URL or form for the buyer) and `verifyCallback` (verifies the incoming callback and returns the result). The HMAC/signature verification of iyzico callbacks must live inside `verifyCallback`.

2. Wire the new provider into the `getPaymentProvider()` switch in `src/lib/payment/index.ts`:
   ```ts
   case "iyzico":
     return new IyzicoPaymentProvider(config.appUrl, /* iyzico config */);
   ```

3. Set `PAYMENT_PROVIDER=iyzico` in your `.env`.

4. Point iyzico's callback URL at `/api/payment/callback`.

5. Delete the dev-only stub confirmation route at `src/app/pay/[token]/confirm/route.ts`. That route exists only to simulate a payment callback and must not be present in production.

No other call sites change because everything goes through `getPaymentProvider()`.

## Production notes

**Database:** the app uses PostgreSQL via `@prisma/adapter-pg`. On Vercel (or any serverless host) a local file database will not work, so provision a hosted Postgres (Vercel Postgres, Neon, or Supabase), set `DATABASE_URL` to its connection string in the host's environment variables, and run `npx prisma migrate deploy` against it once. `guestNames` is stored as a JSON-encoded text column for simplicity.

**App URL:** set `NEXT_PUBLIC_APP_URL` to the real public domain. It is embedded in every payment link and in the callback URL passed to the payment provider, so an incorrect value will break the payment flow.

**Admin password hashing:** passwords are hashed with SHA-256, which is acceptable for a single admin account on a short-lived event. If this project is extended or reused with multiple admins, replace SHA-256 with bcrypt or argon2 in `src/app/admin/login/actions.ts` and `scripts/create-admin.ts`.

**KVKK / GDPR:** the app stores applicants' names, email addresses, social handles, and guests' first names. The public application form includes a consent checkbox. After the event, delete all personal data (a `prisma.application.deleteMany()` call or a small cleanup script is sufficient for a one-off event). The commissioner is the data controller and is responsible for maintaining a record of processing activities.

## Commissioner's legal checklist (outside this codebase)

Before going live, the commissioner should:

- Confirm with their accountant that their business entity is authorised to sell event tickets online (card-not-present transactions are legally distinct from in-restaurant or physical POS sales in Turkey).
- Open an iyzico merchant account and complete iyzico's KYC process.
- Set up e-Arsiv fatura issuance for each ticket sale and confirm KDV (VAT) treatment with their accountant.

These obligations are the commissioner's responsibility and are not handled by this application.
