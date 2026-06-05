# KİNDZİ FEST — Session Handoff (2026-06-05)

A continuation guide for picking this project up in a new session. Read this first.

## What this is
**KİNDZİ FEST** — an approval-gated festival ticketing web app, commissioned by the
owners of **Deniz'in Yeri Dua Yeri** (a venue in **Fatsa, Ordu**, Black Sea / Karadeniz).
Flow: applicants submit name + email + public social handle → the commissioner manually
vets each one (to "smoke out" bad actors) → approved buyers get a unique, expiring payment
link → they pay → they appear on a door list. The gate is **per-buyer**: one approved buyer
can buy multiple tickets for named guests (max 6).

Event: **12 Temmuz 2026, Pazar**. 09:00–18:00 atölyeler & panayır; 18:00–01:00 DJ'ler & **Soner Arıca** (canlı). ~150–200 expected applicants, one-off event.

## HARD RULES (do not break)
- **The entire user-facing app is Turkish only. Never English** — copy, labels, buttons,
  validation/error messages, emails, CSV headers, page title. (DB enum values stay English
  internally: PENDING/APPROVED/PAID/REJECTED, shown via Turkish label maps.) Tone: polite "siz". Currency shown as "TL".
- **No em-dashes (—) in any prose/copy.** Use commas, periods, parentheses. (En dashes in
  numeric time ranges like "09:00–18:00" are fine.)

## Status: what's DONE
- Full MVP: public form, manual approval, state machine (PENDING→APPROVED→PAID, REJECTED side-exit), expiring pay tokens, **stub** payment, emails, door CSV. (Original spec/plan in `docs/superpowers/`.)
- **Turkish** localization throughout.
- **Karadeniz "Yayla" redesign**: cream/deep-green/hazelnut palette, Fraunces + Hanken Grotesk fonts (Turkish subsets), custom misty **ridge** SVG motif (`src/components/ornaments.tsx`), tasteful animations (scroll-reveal, lightbox transition, ridge drift, button lifts) honoring `prefers-reduced-motion`.
- **Real venue photos** pulled from their public Instagram into `public/venue/` (6 curated, 640px), shown in a **clickable lightbox gallery** (`src/components/gallery.tsx`) with prev/next, keyboard, touch-swipe.
- **Logo** (`public/logo.jpg`, from their IG profile, white bg) placed in hero/footer/thank-you/payment/admin + favicon (`src/app/icon.jpg`), blended onto cream via `mix-blend-multiply` (`src/components/brand-logo.tsx`).
- **Mobile** reviewed and fixed (reliable reveal, lightbox arrow z-index/contrast, swipe).
- **Admin operation**: dashboard at `/admin`, filter pills, Onayla/Reddet; for APPROVED rows a **"Bağlantıyı kopyala"** button + **"Yeniden gönder"** (re-issues token + resends). Approve also auto-emails (console in dev).
- **Database migrated SQLite → PostgreSQL** (`@prisma/adapter-pg`) for deployment, and **verified working end-to-end locally on Postgres**.

## Tech stack + version gotchas
- **Next.js 16** (App Router): `params`/`searchParams`/`cookies()` are async (await them). See repo `AGENTS.md` (warns it differs from training data; read `node_modules/next/dist/docs/` when unsure).
- **Prisma 7**: needs a **driver adapter** (no `url` in schema; no `datasourceUrl` constructor). Uses `@prisma/adapter-pg`. With a `prisma.config.ts` present, **Prisma does NOT auto-load `.env`** — we call `process.loadEnvFile()` in `prisma.config.ts`. `prisma migrate dev` auto-creates the database; `migrate deploy` does not.
- **Zod 4**: use top-level `z.email()` / `z.url()` (not `z.string().email()`).
- **iron-session 8**: `getIronSession(await cookies(), options)`.
- **Tailwind v4**: CSS-first config via `@theme` in `src/app/globals.css` (palette + fonts).

## Architecture (key files)
- Domain logic (pure, unit-tested): `src/lib/` — `config.ts`, `state-machine.ts`, `validation.ts`, `token.ts`, `csv.ts`, `payment/` (interface + stub + selector), `notify/` (interface + console/resend), `applications.ts` (DB use-cases: create/approve/reject/markPaidByToken/reissuePayLink), `prisma.ts` (pg adapter singleton), `session.ts`, `event.ts` (KİNDZİ FEST details + gallery list).
- Web: `src/app/page.tsx` (landing+form), `apply-form.tsx`, `apply/actions.ts`, `pay/[token]/page.tsx` + `confirm/route.ts` (dev-only stub), `api/payment/callback/route.ts`, `admin/*` (login, dashboard, actions, door CSV).
- Components: `ornaments.tsx`, `gallery.tsx`, `brand-logo.tsx`, `reveal.tsx`, `copy-link.tsx`.
- `prisma/schema.prisma` (postgresql) + `prisma/migrations/` (Postgres init).

## Run it locally
1. Postgres must be running locally. Connection string is in `.env` (gitignored): `DATABASE_URL` points at the `festival_gate` database on localhost:5432.
2. `npx prisma migrate deploy` then `npx prisma generate` (DB already created this session).
3. `npx tsx scripts/create-admin.ts you@mail.com "yourpass"` (dev admin from this session: `admin@example.com` / `test1234`).
4. `npm run dev` → http://localhost:3000 (admin at `/admin/login`).
5. Tests: `npm test` → 33 pass; 7 DB-backed tests **skip** unless a Postgres test DB is reachable (see README "Testing" for `DATABASE_URL_TEST` + `festival_gate_test`).

## Git
- Single repo, working on branch **`main`** (no remote yet). Everything committed. `.env` and `*.db` are gitignored.

## Payment + email reality
- **Payment is a STUB** (marks paid without charging). Real money needs **iyzico**: implement `IyzicoPaymentProvider` against `src/lib/payment/types.ts`, wire into `getPaymentProvider()`, HMAC-verify inside `verifyCallback`, set `PAYMENT_PROVIDER=iyzico`, point iyzico callback at `/api/payment/callback`, delete the dev stub `pay/[token]/confirm/route.ts`. (See README.)
- **Email** is `NOTIFIER=console` (logs the pay link to the server console). The dashboard **copy-link** button means email isn't required to operate. For real auto-email: Resend account + verified domain, set `NOTIFIER=resend` + `RESEND_API_KEY` + `MAIL_FROM`.

## NEXT STEPS (in priority order)
1. **Deploy** (current focus): push to GitHub → import on Vercel (free `*.vercel.app` URL; commissioner has no domain and doesn't need one) → add free hosted Postgres (Neon / Vercel Postgres) → set env vars on Vercel (`DATABASE_URL`, `SESSION_PASSWORD`, `NEXT_PUBLIC_APP_URL` = the vercel URL, `EVENT_NAME`, etc.) → `prisma migrate deploy` against the cloud DB → create admin there. Double-check no secrets are committed before pushing.
2. **iyzico** real payments (needs commissioner's merchant account + legal homework below).
3. **Auto-email** via Resend (optional; copy-link covers launch).
4. **Public-form rate limiting** (spec §5; only honeypot exists now).
5. Optional polish: higher-res / transparent **mountain** logo if commissioner provides one; custom favicon; post-event KVKK data deletion.

## Commissioner's legal homework (not code)
Confirm entity can sell event tickets online (card-not-present, distinct from restaurant POS); open iyzico merchant account + KYC; e-Arşiv fatura + KDV. Their responsibility.

## How to work with this user
Web-dev beginner; prefers **incremental, one-feature-at-a-time**, with explanations. Verify changes (build + tests) before claiming done. Show screenshots for visual work. Commit when they approve. They drive design decisions, offer options.
