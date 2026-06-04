# Festival Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an approval-gated festival ticketing app where applicants apply, a commissioner manually approves buyers, and approved buyers pay (stub provider now, iyzico later) for one or more tickets including named guests.

**Architecture:** A Next.js (App Router) app backed by Prisma. Core domain logic (state machine, validation, payment, notifications) lives in pure, unit-tested modules under `src/lib/`. The web layer (forms, admin screens, API routes) depends only on those modules. Payment and email are behind interfaces so the Stub implementations used now can be swapped for iyzico/Resend later without touching call sites.

**Tech Stack:** Next.js (App Router, TypeScript), Prisma (SQLite for dev, Postgres for prod), iron-session, Zod, Vitest, Resend. Mirror the versions and patterns already proven in the Telegrad project (Next 16 async route params, Prisma 7, Zod 4, iron-session 8).

---

## File Structure

```
festival-gate/
├── prisma/
│   └── schema.prisma                # Application + AdminUser models
├── src/
│   ├── lib/
│   │   ├── config.ts                # env-driven config, Zod-validated
│   │   ├── state-machine.ts         # PENDING→APPROVED→PAID guards (pure)
│   │   ├── validation.ts            # Zod schemas: application input
│   │   ├── token.ts                 # secure payToken generation
│   │   ├── prisma.ts                # Prisma client singleton
│   │   ├── session.ts               # iron-session admin auth helpers
│   │   ├── applications.ts          # DB use-cases: create/approve/reject/markPaid
│   │   ├── payment/
│   │   │   ├── types.ts             # PaymentProvider interface
│   │   │   ├── stub.ts              # Stub provider (no merchant account)
│   │   │   └── index.ts             # provider selector via config
│   │   └── notify/
│   │       ├── types.ts             # Notifier interface + message builders
│   │       ├── resend.ts            # Resend implementation
│   │       └── index.ts             # notifier selector via config
│   ├── app/
│   │   ├── page.tsx                 # public application form
│   │   ├── apply/actions.ts         # server action: submit application
│   │   ├── pay/[token]/page.tsx     # token-gated payment page
│   │   ├── pay/[token]/confirm/route.ts  # stub "pay now" -> callback
│   │   ├── api/payment/callback/route.ts # provider callback -> mark PAID
│   │   ├── admin/login/page.tsx     # admin login
│   │   ├── admin/login/actions.ts   # login/logout server actions
│   │   ├── admin/page.tsx           # dashboard list + filters
│   │   ├── admin/actions.ts         # approve/reject server actions
│   │   └── admin/door/route.ts      # CSV export of paid attendees
│   └── test/
│       └── helpers.ts               # test db reset + factories
└── docs/superpowers/specs/2026-06-04-festival-gate-design.md
```

---

## Task 0: Scaffold the project

**Files:**
- Create: project skeleton, `package.json`, `vitest.config.ts`, `.env.example`, `.gitignore`

- [ ] **Step 1: Scaffold Next.js app in place**

The repo at `d:/Projects/festival-gate` already exists with git initialized and the `docs/` folder. Scaffold into it:

```bash
cd d:/Projects/festival-gate
npx create-next-app@latest . --ts --app --tailwind --eslint --src-dir --import-alias "@/*" --no-turbopack
```

When prompted that the directory is not empty, keep the existing `docs/` and `.git/`.

- [ ] **Step 2: Install runtime + dev dependencies**

```bash
npm install @prisma/client iron-session zod resend
npm install -D prisma vitest @vitejs/plugin-react vite-tsconfig-paths
```

- [ ] **Step 3: Add Vitest config**

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    globals: true,
    setupFiles: [],
    // config.ts validates these at import time; provide test defaults so any
    // module that imports config can be unit-tested without a real .env.
    env: {
      DATABASE_URL: "file:./test.db",
      SESSION_PASSWORD: "test-password-test-password-test-1234",
      EVENT_NAME: "Test Fest",
      TICKET_PRICE: "500",
      MAX_TICKETS_PER_BUYER: "6",
      PAY_TOKEN_TTL_HOURS: "72",
      PAYMENT_PROVIDER: "stub",
      NOTIFIER: "console",
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    },
  },
});
```

Add to `package.json` scripts: `"test": "vitest run"`, `"test:watch": "vitest"`.

Note: the DB-backed tests in Task 8 run against `test.db`. Before running them the first time, create that schema: `cross-env DATABASE_URL="file:./test.db" npx prisma migrate deploy` (install `cross-env` as a dev dep), or simply reuse `dev.db` locally. The plan's pure-logic tests (Tasks 2–7) need no database.

- [ ] **Step 4: Add env example**

Create `.env.example`:

```
DATABASE_URL="file:./dev.db"
SESSION_PASSWORD="change-me-to-a-32+char-random-string"
EVENT_NAME="Festival"
TICKET_PRICE="500"
MAX_TICKETS_PER_BUYER="6"
PAY_TOKEN_TTL_HOURS="72"
PAYMENT_PROVIDER="stub"
NOTIFIER="console"
RESEND_API_KEY=""
MAIL_FROM="Festival <tickets@example.com>"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

Copy to `.env` and set a real `SESSION_PASSWORD`.

- [ ] **Step 5: Verify it builds and commit**

```bash
npm run build
git add -A
git commit -m "chore: scaffold Next.js app with Vitest and deps"
```

Expected: build succeeds.

---

## Task 1: Prisma schema and client

**Files:**
- Create: `prisma/schema.prisma`, `src/lib/prisma.ts`

- [ ] **Step 1: Write the schema**

Create `prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

enum Status {
  PENDING
  APPROVED
  REJECTED
  PAID
}

model Application {
  id                String   @id @default(cuid())
  createdAt         DateTime @default(now())
  name              String
  email             String
  socialTags        String
  ticketQuantity    Int
  guestNames        String   // JSON-encoded string[] (SQLite has no array type)
  status            Status   @default(PENDING)
  payToken          String?  @unique
  payTokenExpiresAt DateTime?
  amount            Int?
  paymentRef        String?
  paidAt            DateTime?
  reviewNote        String?
}

model AdminUser {
  id           String @id @default(cuid())
  email        String @unique
  passwordHash String
}
```

Note: switch `provider` to `postgresql` for production; SQLite keeps local dev simple. `guestNames` is JSON text because SQLite lacks arrays.

- [ ] **Step 2: Create and apply the migration**

```bash
npx prisma migrate dev --name init
```

Expected: creates `prisma/migrations/...` and `dev.db`, generates the client.

- [ ] **Step 3: Add the Prisma client singleton**

Create `src/lib/prisma.ts`:

```ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add Prisma schema and client singleton"
```

---

## Task 2: Config module (TDD)

**Files:**
- Create: `src/lib/config.ts`
- Test: `src/lib/config.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/config.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { loadConfig } from "./config";

describe("loadConfig", () => {
  const base = {
    EVENT_NAME: "Test Fest",
    TICKET_PRICE: "500",
    MAX_TICKETS_PER_BUYER: "6",
    PAY_TOKEN_TTL_HOURS: "72",
    PAYMENT_PROVIDER: "stub",
    NOTIFIER: "console",
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  };

  it("parses numeric and enum fields", () => {
    const c = loadConfig(base);
    expect(c.ticketPrice).toBe(500);
    expect(c.maxTicketsPerBuyer).toBe(6);
    expect(c.payTokenTtlHours).toBe(72);
    expect(c.paymentProvider).toBe("stub");
  });

  it("rejects an invalid provider", () => {
    expect(() => loadConfig({ ...base, PAYMENT_PROVIDER: "bitcoin" })).toThrow();
  });

  it("rejects a non-numeric ticket price", () => {
    expect(() => loadConfig({ ...base, TICKET_PRICE: "free" })).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/config.test.ts`
Expected: FAIL ("loadConfig is not a function" / module not found).

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/config.ts`:

```ts
import { z } from "zod";

const intString = z.string().regex(/^\d+$/, "must be an integer").transform(Number);

const schema = z.object({
  EVENT_NAME: z.string().min(1),
  TICKET_PRICE: intString,
  MAX_TICKETS_PER_BUYER: intString,
  PAY_TOKEN_TTL_HOURS: intString,
  PAYMENT_PROVIDER: z.enum(["stub", "iyzico"]),
  NOTIFIER: z.enum(["console", "resend"]),
  NEXT_PUBLIC_APP_URL: z.string().url(),
});

export type Config = {
  eventName: string;
  ticketPrice: number;
  maxTicketsPerBuyer: number;
  payTokenTtlHours: number;
  paymentProvider: "stub" | "iyzico";
  notifier: "console" | "resend";
  appUrl: string;
};

export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const p = schema.parse(env);
  return {
    eventName: p.EVENT_NAME,
    ticketPrice: p.TICKET_PRICE,
    maxTicketsPerBuyer: p.MAX_TICKETS_PER_BUYER,
    payTokenTtlHours: p.PAY_TOKEN_TTL_HOURS,
    paymentProvider: p.PAYMENT_PROVIDER,
    notifier: p.NOTIFIER,
    appUrl: p.NEXT_PUBLIC_APP_URL,
  };
}

export const config = loadConfig();
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/config.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/config.ts src/lib/config.test.ts
git commit -m "feat: add Zod-validated config module"
```

---

## Task 3: State machine (TDD) — the heart of the gate

**Files:**
- Create: `src/lib/state-machine.ts`
- Test: `src/lib/state-machine.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/state-machine.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { approve, reject, assertPayable, TransitionError } from "./state-machine";

const future = new Date(Date.now() + 60 * 60 * 1000);
const past = new Date(Date.now() - 60 * 1000);
const now = new Date();

describe("approve", () => {
  it("moves PENDING to APPROVED", () => {
    expect(approve("PENDING")).toBe("APPROVED");
  });
  it("rejects approving a non-PENDING application", () => {
    expect(() => approve("PAID")).toThrow(TransitionError);
  });
});

describe("reject", () => {
  it("moves PENDING to REJECTED", () => {
    expect(reject("PENDING")).toBe("REJECTED");
  });
  it("moves APPROVED to REJECTED", () => {
    expect(reject("APPROVED")).toBe("REJECTED");
  });
  it("refuses to reject a PAID application", () => {
    expect(() => reject("PAID")).toThrow(TransitionError);
  });
});

describe("assertPayable", () => {
  it("allows an APPROVED app with a live token", () => {
    expect(() =>
      assertPayable({ status: "APPROVED", payTokenExpiresAt: future, paidAt: null }, now)
    ).not.toThrow();
  });
  it("blocks payment when still PENDING", () => {
    expect(() =>
      assertPayable({ status: "PENDING", payTokenExpiresAt: future, paidAt: null }, now)
    ).toThrow(TransitionError);
  });
  it("blocks payment when the token expired", () => {
    expect(() =>
      assertPayable({ status: "APPROVED", payTokenExpiresAt: past, paidAt: null }, now)
    ).toThrow(TransitionError);
  });
  it("blocks a second payment when already PAID", () => {
    expect(() =>
      assertPayable({ status: "PAID", payTokenExpiresAt: future, paidAt: now }, now)
    ).toThrow(TransitionError);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/state-machine.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/state-machine.ts`:

```ts
export type Status = "PENDING" | "APPROVED" | "REJECTED" | "PAID";

export class TransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TransitionError";
  }
}

export function approve(status: Status): "APPROVED" {
  if (status !== "PENDING") {
    throw new TransitionError(`Cannot approve from ${status}`);
  }
  return "APPROVED";
}

export function reject(status: Status): "REJECTED" {
  if (status === "PAID") {
    throw new TransitionError("Cannot reject a paid application");
  }
  return "REJECTED";
}

export type PayableApplication = {
  status: Status;
  payTokenExpiresAt: Date | null;
  paidAt: Date | null;
};

export function assertPayable(app: PayableApplication, now: Date): void {
  if (app.status === "PAID" || app.paidAt) {
    throw new TransitionError("Application is already paid");
  }
  if (app.status !== "APPROVED") {
    throw new TransitionError(`Application is not approved (status ${app.status})`);
  }
  if (!app.payTokenExpiresAt || app.payTokenExpiresAt.getTime() <= now.getTime()) {
    throw new TransitionError("Payment link has expired");
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/state-machine.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/state-machine.ts src/lib/state-machine.test.ts
git commit -m "feat: add application state machine with transition guards"
```

---

## Task 4: Application input validation (TDD)

**Files:**
- Create: `src/lib/validation.ts`
- Test: `src/lib/validation.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/validation.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildApplicationSchema } from "./validation";

const schema = buildApplicationSchema(6);
const valid = {
  name: "Ali Veli",
  email: "ali@example.com",
  socialTags: "@ali_insta",
  ticketQuantity: 3,
  guestNames: ["Ayse", "Mehmet"],
  website: "",
};

describe("application schema", () => {
  it("accepts a valid party of 3 with 2 guests", () => {
    expect(schema.parse(valid)).toMatchObject({ ticketQuantity: 3 });
  });
  it("rejects when guest count does not equal quantity - 1", () => {
    expect(() => schema.parse({ ...valid, guestNames: ["Ayse"] })).toThrow();
  });
  it("rejects quantity above the max", () => {
    expect(() =>
      schema.parse({ ...valid, ticketQuantity: 7, guestNames: ["a", "b", "c", "d", "e", "f"] })
    ).toThrow();
  });
  it("rejects a quantity below 1", () => {
    expect(() => schema.parse({ ...valid, ticketQuantity: 0, guestNames: [] })).toThrow();
  });
  it("accepts a solo buyer with no guests", () => {
    expect(() =>
      schema.parse({ ...valid, ticketQuantity: 1, guestNames: [] })
    ).not.toThrow();
  });
  it("rejects a bad email", () => {
    expect(() => schema.parse({ ...valid, email: "nope" })).toThrow();
  });
  it("rejects when the honeypot is filled", () => {
    expect(() => schema.parse({ ...valid, website: "spam" })).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/validation.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/validation.ts`:

```ts
import { z } from "zod";

export function buildApplicationSchema(maxTickets: number) {
  return z
    .object({
      name: z.string().trim().min(1).max(120),
      email: z.string().trim().email(),
      socialTags: z.string().trim().min(1).max(500),
      ticketQuantity: z.coerce.number().int().min(1).max(maxTickets),
      guestNames: z.array(z.string().trim().min(1).max(80)).max(maxTickets - 1),
      website: z.string().max(0, "honeypot must be empty").optional().default(""),
    })
    .refine((d) => d.guestNames.length === d.ticketQuantity - 1, {
      message: "Number of guest names must equal ticket quantity minus one",
      path: ["guestNames"],
    });
}

export type ApplicationInput = z.infer<ReturnType<typeof buildApplicationSchema>>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/validation.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/validation.ts src/lib/validation.test.ts
git commit -m "feat: add application input validation with quantity/guest rules"
```

---

## Task 5: Secure token generation (TDD)

**Files:**
- Create: `src/lib/token.ts`
- Test: `src/lib/token.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/token.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { generatePayToken, expiryFromNow } from "./token";

describe("generatePayToken", () => {
  it("produces a long url-safe token", () => {
    const t = generatePayToken();
    expect(t).toMatch(/^[A-Za-z0-9_-]{32,}$/);
  });
  it("produces unique tokens", () => {
    expect(generatePayToken()).not.toBe(generatePayToken());
  });
});

describe("expiryFromNow", () => {
  it("adds the given hours", () => {
    const base = new Date("2026-06-04T00:00:00Z");
    expect(expiryFromNow(72, base).toISOString()).toBe("2026-06-07T00:00:00.000Z");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/token.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/token.ts`:

```ts
import { randomBytes } from "node:crypto";

export function generatePayToken(): string {
  return randomBytes(32).toString("base64url");
}

export function expiryFromNow(hours: number, base: Date = new Date()): Date {
  return new Date(base.getTime() + hours * 60 * 60 * 1000);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/token.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/token.ts src/lib/token.test.ts
git commit -m "feat: add secure pay-token generation and expiry helper"
```

---

## Task 6: Payment provider interface + Stub (TDD)

**Files:**
- Create: `src/lib/payment/types.ts`, `src/lib/payment/stub.ts`, `src/lib/payment/index.ts`
- Test: `src/lib/payment/stub.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/payment/stub.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { StubPaymentProvider } from "./stub";

const provider = new StubPaymentProvider("http://localhost:3000");

describe("StubPaymentProvider", () => {
  it("creates a checkout pointing at the local confirm route", async () => {
    const s = await provider.createCheckout({
      applicationId: "app1",
      amount: 1500,
      email: "ali@example.com",
      payToken: "TOKEN123",
    });
    expect(s.url).toBe("http://localhost:3000/pay/TOKEN123/confirm");
    expect(s.ref).toMatch(/^stub_/);
  });

  it("verifies a callback carrying a payToken", async () => {
    const r = await provider.verifyCallback({ payToken: "TOKEN123", ref: "stub_abc" });
    expect(r).toEqual({ ok: true, payToken: "TOKEN123", ref: "stub_abc" });
  });

  it("rejects a callback with no payToken", async () => {
    const r = await provider.verifyCallback({});
    expect(r.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/payment/stub.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Write the interface**

Create `src/lib/payment/types.ts`:

```ts
export type CheckoutInput = {
  applicationId: string;
  amount: number; // integer, in the smallest sensible unit (whole TRY here)
  email: string;
  payToken: string;
};

export type CheckoutSession = {
  url: string; // where to send the buyer to pay
  ref: string; // provider-side reference
};

export type CallbackResult = {
  ok: boolean;
  payToken: string;
  ref: string;
};

export interface PaymentProvider {
  createCheckout(input: CheckoutInput): Promise<CheckoutSession>;
  verifyCallback(payload: unknown): Promise<CallbackResult>;
}
```

- [ ] **Step 4: Write the Stub implementation**

Create `src/lib/payment/stub.ts`:

```ts
import { randomBytes } from "node:crypto";
import type { PaymentProvider, CheckoutInput, CheckoutSession, CallbackResult } from "./types";

export class StubPaymentProvider implements PaymentProvider {
  constructor(private appUrl: string) {}

  async createCheckout(input: CheckoutInput): Promise<CheckoutSession> {
    return {
      url: `${this.appUrl}/pay/${input.payToken}/confirm`,
      ref: `stub_${randomBytes(8).toString("hex")}`,
    };
  }

  async verifyCallback(payload: unknown): Promise<CallbackResult> {
    const p = (payload ?? {}) as { payToken?: string; ref?: string };
    if (!p.payToken) return { ok: false, payToken: "", ref: p.ref ?? "" };
    return { ok: true, payToken: p.payToken, ref: p.ref ?? "" };
  }
}
```

- [ ] **Step 5: Write the provider selector**

Create `src/lib/payment/index.ts`:

```ts
import { config } from "../config";
import type { PaymentProvider } from "./types";
import { StubPaymentProvider } from "./stub";

export function getPaymentProvider(): PaymentProvider {
  switch (config.paymentProvider) {
    case "stub":
      return new StubPaymentProvider(config.appUrl);
    case "iyzico":
      throw new Error("iyzico provider not implemented yet");
    default:
      throw new Error(`Unknown payment provider: ${config.paymentProvider}`);
  }
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run src/lib/payment/stub.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/payment
git commit -m "feat: add payment provider interface and stub implementation"
```

---

## Task 7: Notifier interface + console/Resend (TDD on message building)

**Files:**
- Create: `src/lib/notify/types.ts`, `src/lib/notify/resend.ts`, `src/lib/notify/index.ts`
- Test: `src/lib/notify/types.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/notify/types.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildApprovalEmail, buildRejectionEmail, buildConfirmationEmail } from "./types";

describe("email builders", () => {
  it("approval email contains the payment link", () => {
    const m = buildApprovalEmail({
      eventName: "Test Fest",
      name: "Ali",
      payUrl: "http://localhost:3000/pay/TOK",
    });
    expect(m.subject).toContain("Test Fest");
    expect(m.text).toContain("http://localhost:3000/pay/TOK");
  });

  it("confirmation email states the quantity", () => {
    const m = buildConfirmationEmail({ eventName: "Test Fest", name: "Ali", ticketQuantity: 3 });
    expect(m.text).toContain("3");
  });

  it("rejection email is polite and has no link", () => {
    const m = buildRejectionEmail({ eventName: "Test Fest", name: "Ali" });
    expect(m.text).not.toContain("http");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/notify/types.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Write the interface + builders**

Create `src/lib/notify/types.ts`:

```ts
export type EmailMessage = { to?: string; subject: string; text: string };

export interface Notifier {
  send(to: string, message: EmailMessage): Promise<void>;
}

export function buildApprovalEmail(p: { eventName: string; name: string; payUrl: string }): EmailMessage {
  return {
    subject: `You're approved for ${p.eventName}`,
    text: `Hi ${p.name},\n\nGood news — you're approved to buy tickets for ${p.eventName}.\nComplete your purchase here (link expires soon):\n${p.payUrl}\n\nSee you there!`,
  };
}

export function buildRejectionEmail(p: { eventName: string; name: string }): EmailMessage {
  return {
    subject: `Update on your ${p.eventName} application`,
    text: `Hi ${p.name},\n\nThank you for your interest in ${p.eventName}. Unfortunately we are not able to offer you tickets at this time.\n\nKind regards.`,
  };
}

export function buildConfirmationEmail(p: { eventName: string; name: string; ticketQuantity: number }): EmailMessage {
  return {
    subject: `Your ${p.eventName} tickets are confirmed`,
    text: `Hi ${p.name},\n\nYour payment is confirmed. You have ${p.ticketQuantity} ticket(s) for ${p.eventName}.\nBring your ID to the entrance.\n\nSee you there!`,
  };
}
```

- [ ] **Step 4: Write the Resend + console implementations and selector**

Create `src/lib/notify/resend.ts`:

```ts
import { Resend } from "resend";
import type { Notifier, EmailMessage } from "./types";

export class ResendNotifier implements Notifier {
  private client: Resend;
  constructor(apiKey: string, private from: string) {
    this.client = new Resend(apiKey);
  }
  async send(to: string, message: EmailMessage): Promise<void> {
    await this.client.emails.send({
      from: this.from,
      to,
      subject: message.subject,
      text: message.text,
    });
  }
}

export class ConsoleNotifier implements Notifier {
  async send(to: string, message: EmailMessage): Promise<void> {
    console.log(`[email] to=${to} subject="${message.subject}"\n${message.text}`);
  }
}
```

Create `src/lib/notify/index.ts`:

```ts
import { config } from "../config";
import type { Notifier } from "./types";
import { ResendNotifier, ConsoleNotifier } from "./resend";

export function getNotifier(): Notifier {
  if (config.notifier === "resend") {
    const apiKey = process.env.RESEND_API_KEY ?? "";
    const from = process.env.MAIL_FROM ?? "Festival <tickets@example.com>";
    if (!apiKey) throw new Error("RESEND_API_KEY is required when NOTIFIER=resend");
    return new ResendNotifier(apiKey, from);
  }
  return new ConsoleNotifier();
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/lib/notify/types.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/notify
git commit -m "feat: add notifier interface, email builders, console/resend impls"
```

---

## Task 8: Application use-cases over the DB (TDD with SQLite test db)

**Files:**
- Create: `src/lib/applications.ts`, `src/test/helpers.ts`
- Test: `src/lib/applications.test.ts`

These functions wrap the state machine + token + DB writes. Tests run against a real SQLite file so we exercise Prisma.

- [ ] **Step 1: Add a test helper that resets the db**

Create `src/test/helpers.ts`:

```ts
import { prisma } from "@/lib/prisma";

export async function resetDb() {
  await prisma.application.deleteMany();
  await prisma.adminUser.deleteMany();
}
```

- [ ] **Step 2: Write the failing test**

Create `src/lib/applications.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDb } from "@/test/helpers";
import {
  createApplication,
  approveApplication,
  rejectApplication,
  markPaidByToken,
} from "./applications";

beforeEach(async () => {
  await resetDb();
});

const input = {
  name: "Ali",
  email: "ali@example.com",
  socialTags: "@ali",
  ticketQuantity: 2,
  guestNames: ["Ayse"],
};

describe("application use-cases", () => {
  it("creates a PENDING application", async () => {
    const a = await createApplication(input);
    expect(a.status).toBe("PENDING");
    expect(JSON.parse(a.guestNames)).toEqual(["Ayse"]);
  });

  it("approve assigns a token and expiry", async () => {
    const a = await createApplication(input);
    const approved = await approveApplication(a.id);
    expect(approved.status).toBe("APPROVED");
    expect(approved.payToken).toBeTruthy();
    expect(approved.payTokenExpiresAt).toBeInstanceOf(Date);
  });

  it("markPaidByToken sets PAID, amount and paymentRef", async () => {
    const a = await createApplication(input);
    const approved = await approveApplication(a.id);
    const paid = await markPaidByToken(approved.payToken!, "stub_ref", 1000);
    expect(paid.status).toBe("PAID");
    expect(paid.amount).toBe(1000);
    expect(paid.paymentRef).toBe("stub_ref");
    expect(paid.paidAt).toBeInstanceOf(Date);
  });

  it("markPaidByToken refuses a second payment", async () => {
    const a = await createApplication(input);
    const approved = await approveApplication(a.id);
    await markPaidByToken(approved.payToken!, "stub_ref", 1000);
    await expect(markPaidByToken(approved.payToken!, "x", 1000)).rejects.toThrow();
  });

  it("markPaidByToken refuses an unknown token", async () => {
    await expect(markPaidByToken("nope", "x", 1000)).rejects.toThrow();
  });

  it("reject moves to REJECTED", async () => {
    const a = await createApplication(input);
    const r = await rejectApplication(a.id);
    expect(r.status).toBe("REJECTED");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/lib/applications.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 4: Write the implementation**

Create `src/lib/applications.ts`:

```ts
import { prisma } from "./prisma";
import { config } from "./config";
import { approve, reject, assertPayable } from "./state-machine";
import { generatePayToken, expiryFromNow } from "./token";

export type CreateInput = {
  name: string;
  email: string;
  socialTags: string;
  ticketQuantity: number;
  guestNames: string[];
};

export async function createApplication(input: CreateInput) {
  return prisma.application.create({
    data: {
      name: input.name,
      email: input.email,
      socialTags: input.socialTags,
      ticketQuantity: input.ticketQuantity,
      guestNames: JSON.stringify(input.guestNames),
    },
  });
}

export async function approveApplication(id: string) {
  const app = await prisma.application.findUniqueOrThrow({ where: { id } });
  const next = approve(app.status); // throws if illegal
  return prisma.application.update({
    where: { id },
    data: {
      status: next,
      payToken: generatePayToken(),
      payTokenExpiresAt: expiryFromNow(config.payTokenTtlHours),
    },
  });
}

export async function rejectApplication(id: string) {
  const app = await prisma.application.findUniqueOrThrow({ where: { id } });
  const next = reject(app.status); // throws if PAID
  return prisma.application.update({ where: { id }, data: { status: next } });
}

export async function markPaidByToken(payToken: string, paymentRef: string, amount: number) {
  const app = await prisma.application.findUnique({ where: { payToken } });
  if (!app) throw new Error("Unknown payment token");
  assertPayable(app, new Date()); // throws if not approved / expired / already paid
  return prisma.application.update({
    where: { id: app.id },
    data: { status: "PAID", paymentRef, amount, paidAt: new Date() },
  });
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/lib/applications.test.ts`
Expected: PASS (all cases). If Prisma complains about the client, run `npx prisma generate` first.

- [ ] **Step 6: Commit**

```bash
git add src/lib/applications.ts src/test/helpers.ts src/lib/applications.test.ts
git commit -m "feat: add DB-backed application use-cases over the state machine"
```

---

## Task 9: Public application form + submit action

**Files:**
- Create: `src/app/apply/actions.ts`, `src/app/page.tsx`

- [ ] **Step 1: Write the submit server action**

Create `src/app/apply/actions.ts`:

```ts
"use server";

import { redirect } from "next/navigation";
import { config } from "@/lib/config";
import { buildApplicationSchema } from "@/lib/validation";
import { createApplication } from "@/lib/applications";

export type SubmitState = { error?: string };

export async function submitApplication(
  _prev: SubmitState,
  formData: FormData
): Promise<SubmitState> {
  const schema = buildApplicationSchema(config.maxTicketsPerBuyer);
  const guestNames = formData.getAll("guestNames").map(String).filter((s) => s.trim() !== "");

  const parsed = schema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    socialTags: formData.get("socialTags"),
    ticketQuantity: formData.get("ticketQuantity"),
    guestNames,
    website: formData.get("website") ?? "",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  await createApplication({
    name: parsed.data.name,
    email: parsed.data.email,
    socialTags: parsed.data.socialTags,
    ticketQuantity: parsed.data.ticketQuantity,
    guestNames: parsed.data.guestNames,
  });

  redirect("/?submitted=1");
}
```

- [ ] **Step 2: Write the form page**

Create `src/app/page.tsx`:

```tsx
import { config } from "@/lib/config";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ submitted?: string }>;
}) {
  const { submitted } = await searchParams;

  if (submitted) {
    return (
      <main className="mx-auto max-w-lg p-8">
        <h1 className="text-2xl font-bold">Thank you</h1>
        <p className="mt-4">
          Your application for {config.eventName} has been received. If approved,
          you&apos;ll get an email with a link to buy your tickets.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-lg p-8">
      <h1 className="text-2xl font-bold">Apply for {config.eventName}</h1>
      <form action="/apply" method="post" className="mt-6 space-y-4">
        {/* progressive enhancement note: wired via server action below */}
      </form>
      <ApplyForm maxTickets={config.maxTicketsPerBuyer} />
    </main>
  );
}

import ApplyForm from "./apply-form";
```

- [ ] **Step 3: Write the client form component**

Create `src/app/apply-form.tsx`:

```tsx
"use client";

import { useActionState, useState } from "react";
import { submitApplication, type SubmitState } from "./apply/actions";

export default function ApplyForm({ maxTickets }: { maxTickets: number }) {
  const [state, action, pending] = useActionState<SubmitState, FormData>(
    submitApplication,
    {}
  );
  const [quantity, setQuantity] = useState(1);
  const guestCount = Math.max(0, quantity - 1);

  return (
    <form action={action} className="space-y-4">
      <input name="name" placeholder="Full name" required className="w-full border p-2" />
      <input name="email" type="email" placeholder="Email" required className="w-full border p-2" />
      <input
        name="socialTags"
        placeholder="Your public social handles (e.g. @you on Instagram)"
        required
        className="w-full border p-2"
      />
      <label className="block">
        Tickets
        <select
          name="ticketQuantity"
          value={quantity}
          onChange={(e) => setQuantity(Number(e.target.value))}
          className="ml-2 border p-2"
        >
          {Array.from({ length: maxTickets }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
      {Array.from({ length: guestCount }, (_, i) => (
        <input
          key={i}
          name="guestNames"
          placeholder={`Guest ${i + 1} first name`}
          required
          className="w-full border p-2"
        />
      ))}
      {/* honeypot: hidden from humans, bots fill it */}
      <input
        name="website"
        tabIndex={-1}
        autoComplete="off"
        className="hidden"
        aria-hidden="true"
      />
      <label className="block text-sm text-gray-600">
        <input type="checkbox" required className="mr-2" />
        I consent to my data (and my guests&apos; first names, with their permission)
        being stored for event entry, and deleted after the event.
      </label>
      {state.error && <p className="text-red-600">{state.error}</p>}
      <button disabled={pending} className="bg-black px-4 py-2 text-white">
        {pending ? "Submitting…" : "Apply"}
      </button>
    </form>
  );
}
```

Then simplify `src/app/page.tsx` to remove the stray `<form>` placeholder block (keep only the heading + `<ApplyForm />`). Move the `import ApplyForm` to the top of the file.

- [ ] **Step 4: Manually verify**

Run: `npm run dev`, open `http://localhost:3000`, submit with quantity 3 → expect a thank-you page. Check the row exists:

```bash
npx prisma studio
```

Expected: one PENDING Application with `guestNames` JSON of length 2.

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx src/app/apply-form.tsx src/app/apply/actions.ts
git commit -m "feat: public application form with quantity, guests, honeypot, consent"
```

---

## Task 10: Admin authentication (iron-session)

**Files:**
- Create: `src/lib/session.ts`, `src/app/admin/login/page.tsx`, `src/app/admin/login/actions.ts`
- Modify: add a seed script for the admin user

- [ ] **Step 1: Write the session helpers**

Create `src/lib/session.ts`:

```ts
import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";

export type AdminSession = { adminId?: string };

const options: SessionOptions = {
  password: process.env.SESSION_PASSWORD as string,
  cookieName: "festival_admin",
  cookieOptions: { secure: process.env.NODE_ENV === "production" },
};

export async function getSession() {
  return getIronSession<AdminSession>(await cookies(), options);
}

export async function requireAdmin(): Promise<string> {
  const session = await getSession();
  if (!session.adminId) throw new Error("UNAUTHORIZED");
  return session.adminId;
}
```

- [ ] **Step 2: Write the login/logout actions**

Create `src/app/admin/login/actions.ts`:

```ts
"use server";

import { redirect } from "next/navigation";
import { createHash, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

function hash(pw: string) {
  return createHash("sha256").update(pw).digest("hex");
}

export async function login(_prev: { error?: string }, formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const admin = await prisma.adminUser.findUnique({ where: { email } });
  if (!admin) return { error: "Invalid credentials" };

  const a = Buffer.from(hash(password));
  const b = Buffer.from(admin.passwordHash);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { error: "Invalid credentials" };
  }

  const session = await getSession();
  session.adminId = admin.id;
  await session.save();
  redirect("/admin");
}

export async function logout() {
  const session = await getSession();
  session.destroy();
  redirect("/admin/login");
}
```

Note: SHA-256 is acceptable for a single admin on a one-off event; upgrade to bcrypt/argon2 if reused. Document this in the README.

- [ ] **Step 3: Write the login page**

Create `src/app/admin/login/page.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import { login } from "./actions";

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, {});
  return (
    <main className="mx-auto max-w-sm p-8">
      <h1 className="text-xl font-bold">Admin login</h1>
      <form action={action} className="mt-6 space-y-4">
        <input name="email" type="email" placeholder="Email" required className="w-full border p-2" />
        <input name="password" type="password" placeholder="Password" required className="w-full border p-2" />
        {state.error && <p className="text-red-600">{state.error}</p>}
        <button disabled={pending} className="bg-black px-4 py-2 text-white">Log in</button>
      </form>
    </main>
  );
}
```

- [ ] **Step 4: Add an admin seed script**

Create `scripts/create-admin.ts`:

```ts
import { createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const [email, password] = process.argv.slice(2);

if (!email || !password) {
  console.error("Usage: npx tsx scripts/create-admin.ts <email> <password>");
  process.exit(1);
}

await prisma.adminUser.upsert({
  where: { email },
  update: { passwordHash: createHash("sha256").update(password).digest("hex") },
  create: { email, passwordHash: createHash("sha256").update(password).digest("hex") },
});
console.log(`Admin ${email} ready.`);
await prisma.$disconnect();
```

Install tsx: `npm install -D tsx`. Create the admin:

```bash
npx tsx scripts/create-admin.ts admin@example.com "a-strong-password"
```

- [ ] **Step 5: Manually verify**

Run `npm run dev`, visit `/admin/login`, log in → redirect to `/admin` (will 404 until Task 11, that's expected). Wrong password → "Invalid credentials".

- [ ] **Step 6: Commit**

```bash
git add src/lib/session.ts src/app/admin/login scripts/create-admin.ts package.json
git commit -m "feat: admin authentication with iron-session and seed script"
```

---

## Task 11: Admin dashboard + approve/reject

**Files:**
- Create: `src/app/admin/page.tsx`, `src/app/admin/actions.ts`

- [ ] **Step 1: Write the approve/reject actions**

Create `src/app/admin/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/session";
import { config } from "@/lib/config";
import { approveApplication, rejectApplication } from "@/lib/applications";
import { getNotifier } from "@/lib/notify";
import { buildApprovalEmail, buildRejectionEmail } from "@/lib/notify/types";

export async function approveAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const app = await approveApplication(id);
  const payUrl = `${config.appUrl}/pay/${app.payToken}`;
  await getNotifier().send(app.email, buildApprovalEmail({
    eventName: config.eventName,
    name: app.name,
    payUrl,
  }));
  revalidatePath("/admin");
}

export async function rejectAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const app = await rejectApplication(id);
  await getNotifier().send(app.email, buildRejectionEmail({
    eventName: config.eventName,
    name: app.name,
  }));
  revalidatePath("/admin");
}
```

- [ ] **Step 2: Write the dashboard page**

Create `src/app/admin/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { approveAction, rejectAction } from "./actions";

const STATUSES = ["PENDING", "APPROVED", "PAID", "REJECTED"] as const;

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await getSession();
  if (!session.adminId) redirect("/admin/login");

  const { status } = await searchParams;
  const where = STATUSES.includes(status as never) ? { status: status as never } : {};
  const apps = await prisma.application.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="mx-auto max-w-5xl p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Applications</h1>
        <a href="/admin/door" className="underline">Download paid attendees (CSV)</a>
      </div>
      <nav className="mt-4 space-x-3">
        <a href="/admin" className="underline">All</a>
        {STATUSES.map((s) => (
          <a key={s} href={`/admin?status=${s}`} className="underline">{s}</a>
        ))}
      </nav>
      <table className="mt-6 w-full text-sm">
        <thead>
          <tr className="text-left">
            <th>Name</th><th>Email</th><th>Social</th><th>Qty</th><th>Guests</th><th>Status</th><th></th>
          </tr>
        </thead>
        <tbody>
          {apps.map((a) => (
            <tr key={a.id} className="border-t">
              <td>{a.name}</td>
              <td>{a.email}</td>
              <td>{a.socialTags}</td>
              <td>{a.ticketQuantity}</td>
              <td>{(JSON.parse(a.guestNames) as string[]).join(", ")}</td>
              <td>{a.status}</td>
              <td className="space-x-2 py-1">
                {a.status === "PENDING" && (
                  <>
                    <form action={approveAction} className="inline">
                      <input type="hidden" name="id" value={a.id} />
                      <button className="bg-green-700 px-2 py-1 text-white">Approve</button>
                    </form>
                    <form action={rejectAction} className="inline">
                      <input type="hidden" name="id" value={a.id} />
                      <button className="bg-red-700 px-2 py-1 text-white">Reject</button>
                    </form>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
```

- [ ] **Step 3: Manually verify**

Log in, see PENDING applications, click Approve → row becomes APPROVED and an `[email]` line appears in the dev server console (ConsoleNotifier) containing a `/pay/<token>` link. Click Reject on another → REJECTED + console email.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/page.tsx src/app/admin/actions.ts
git commit -m "feat: admin dashboard with approve/reject and notifications"
```

---

## Task 12: Payment page + confirm + callback (stub flow end-to-end)

**Files:**
- Create: `src/app/pay/[token]/page.tsx`, `src/app/pay/[token]/confirm/route.ts`, `src/app/api/payment/callback/route.ts`

- [ ] **Step 1: Write the token-gated payment page**

Create `src/app/pay/[token]/page.tsx`:

```tsx
import { prisma } from "@/lib/prisma";
import { config } from "@/lib/config";
import { getPaymentProvider } from "@/lib/payment";
import { assertPayable } from "@/lib/state-machine";

export default async function PayPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const app = await prisma.application.findUnique({ where: { payToken: token } });

  if (!app) {
    return <main className="mx-auto max-w-lg p-8">This payment link is not valid.</main>;
  }
  if (app.status === "PAID") {
    return <main className="mx-auto max-w-lg p-8">You have already paid. See you at {config.eventName}!</main>;
  }

  try {
    assertPayable(app, new Date());
  } catch {
    return <main className="mx-auto max-w-lg p-8">This payment link has expired. Please contact the organizer.</main>;
  }

  const amount = app.ticketQuantity * config.ticketPrice;
  const session = await getPaymentProvider().createCheckout({
    applicationId: app.id,
    amount,
    email: app.email,
    payToken: token,
  });

  return (
    <main className="mx-auto max-w-lg p-8">
      <h1 className="text-2xl font-bold">{config.eventName} — Payment</h1>
      <p className="mt-4">{app.ticketQuantity} ticket(s): <strong>{amount} TRY</strong></p>
      <a href={session.url} className="mt-6 inline-block bg-black px-4 py-2 text-white">
        Pay now
      </a>
    </main>
  );
}
```

- [ ] **Step 2: Write the stub confirm route**

This simulates the user completing payment on the provider's page. For the Stub, "completing" means hitting our own callback. Create `src/app/pay/[token]/confirm/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { config } from "@/lib/config";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  // Post a stub callback to our own callback endpoint, then redirect to success.
  await fetch(`${config.appUrl}/api/payment/callback`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ payToken: token, ref: `stub_confirm` }),
  });
  return NextResponse.redirect(`${config.appUrl}/pay/${token}`);
}
```

Note: when iyzico replaces the stub, this route disappears — iyzico hosts the card page and calls `/api/payment/callback` directly.

- [ ] **Step 3: Write the provider-agnostic callback**

Create `src/app/api/payment/callback/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { config } from "@/lib/config";
import { getPaymentProvider } from "@/lib/payment";
import { markPaidByToken } from "@/lib/applications";
import { getNotifier } from "@/lib/notify";
import { buildConfirmationEmail } from "@/lib/notify/types";

export async function POST(req: NextRequest) {
  const payload = await req.json().catch(() => ({}));
  const result = await getPaymentProvider().verifyCallback(payload);
  if (!result.ok) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const app = await prisma.application.findUnique({ where: { payToken: result.payToken } });
  if (!app) return NextResponse.json({ ok: false }, { status: 404 });

  const amount = app.ticketQuantity * config.ticketPrice;

  try {
    const paid = await markPaidByToken(result.payToken, result.ref, amount);
    await getNotifier().send(paid.email, buildConfirmationEmail({
      eventName: config.eventName,
      name: paid.name,
      ticketQuantity: paid.ticketQuantity,
    }));
    return NextResponse.json({ ok: true });
  } catch {
    // Already paid or not payable — idempotent success so retries don't error.
    return NextResponse.json({ ok: true, note: "no-op" });
  }
}
```

- [ ] **Step 4: Manually verify the whole flow**

1. `npm run dev`.
2. Submit an application at `/`.
3. Approve it in `/admin`; copy the `/pay/<token>` link from the console email.
4. Open the link → see "X ticket(s): N TRY" → click "Pay now".
5. The confirm route fires the callback and redirects back → page now says "You have already paid."
6. `/admin?status=PAID` shows the row as PAID with the amount.
7. Console shows the confirmation email.

- [ ] **Step 5: Commit**

```bash
git add src/app/pay src/app/api/payment
git commit -m "feat: stub payment flow end-to-end (pay page, confirm, callback, mark paid)"
```

---

## Task 13: Door list CSV export

**Files:**
- Create: `src/app/admin/door/route.ts`

- [ ] **Step 1: Write the export route**

Create `src/app/admin/door/route.ts`:

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export async function GET() {
  const session = await getSession();
  if (!session.adminId) return new NextResponse("Unauthorized", { status: 401 });

  const paid = await prisma.application.findMany({
    where: { status: "PAID" },
    orderBy: { name: "asc" },
  });

  const header = ["Buyer", "Email", "Tickets", "Guests"].join(",");
  const rows = paid.map((a) =>
    [
      csvCell(a.name),
      csvCell(a.email),
      String(a.ticketQuantity),
      csvCell((JSON.parse(a.guestNames) as string[]).join("; ")),
    ].join(",")
  );
  const csv = [header, ...rows].join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="door-list.csv"',
    },
  });
}
```

- [ ] **Step 2: Manually verify**

Log in, click "Download paid attendees (CSV)" on `/admin`. Open the file: one row per paid buyer with their guest names. Logged-out request to `/admin/door` returns 401.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/door/route.ts
git commit -m "feat: door-list CSV export of paid attendees and guests"
```

---

## Task 14: Final pass — full test run, README, KVKK note

**Files:**
- Create: `README.md`

- [ ] **Step 1: Run the whole test suite**

Run: `npx vitest run`
Expected: all suites pass (config, state-machine, validation, token, payment/stub, notify/types, applications).

- [ ] **Step 2: Write the README**

Create `README.md` covering: env vars (from `.env.example`), `npx prisma migrate dev`, creating an admin (`npx tsx scripts/create-admin.ts`), running dev, the four statuses, and a **"Switching to iyzico"** section: implement `IyzicoPaymentProvider` against `PaymentProvider` in `src/lib/payment/iyzico.ts`, wire it in `payment/index.ts`, set `PAYMENT_PROVIDER=iyzico`, point iyzico's callback at `/api/payment/callback`, and delete the stub `confirm` route. Add a **KVKK** section: collect consent (already in the form), and delete personal data after the event. Note the SHA-256 admin password caveat.

- [ ] **Step 3: Build check**

Run: `npm run build`
Expected: production build succeeds.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: add README with setup, iyzico swap guide, and KVKK notes"
```

---

## Self-Review Notes (author)

- **Spec coverage:** application form (T9), manual approval (T11), per-buyer quantity + guest names (T4, T9, schema T1), state machine PENDING→APPROVED→PAID/REJECTED (T3, T8), expiring unique pay token (T5, T8), stub-first payment behind interface (T6, T12), server-callback confirmation not browser-trust (T12 callback verifies via provider before marking paid), no double-pay / no resale (T8 `assertPayable`, T12 idempotent), email notifications (T7, T11, T12), KVKK consent + retention (T9 form, T14 README), no capacity cap (intentionally absent), door list (T13), admin auth (T10). All spec requirements mapped.
- **Type consistency:** `PaymentProvider.createCheckout/verifyCallback`, `CallbackResult.{ok,payToken,ref}`, `assertPayable(app, now)`, `approve/reject(status)`, `markPaidByToken(token, ref, amount)`, `buildApplicationSchema(maxTickets)` used consistently across tasks.
- **Note for implementer:** `amount` is whole TRY (integer). If iyzico needs kuruş, convert at the iyzico boundary only, leaving the stored `amount` semantics unchanged or documenting the change in T-iyzico.
```
