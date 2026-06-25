import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  checkRateLimit,
  recordFailure,
  clearAttempts,
  consumeAttempt,
  clientKey,
  emailKey,
  APPLY_RATE_LIMIT,
  LOGIN_EMAIL_RATE_LIMIT,
  type RateLimitConfig,
} from "./rate-limit";

// Pure: no DB, runs even without Postgres.
describe("clientKey", () => {
  const h = (entries: Record<string, string>) => new Headers(entries);

  it("uses the first x-forwarded-for entry (real client behind Vercel)", () => {
    expect(clientKey(h({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" }), "apply")).toBe("apply:1.2.3.4");
  });

  it("trims whitespace around the forwarded IP", () => {
    expect(clientKey(h({ "x-forwarded-for": "  9.9.9.9  , 10.0.0.1" }), "login")).toBe("login:9.9.9.9");
  });

  it("falls back to x-real-ip when no forwarded header", () => {
    expect(clientKey(h({ "x-real-ip": "5.6.7.8" }), "apply")).toBe("apply:5.6.7.8");
  });

  it("prefers the platform-trusted x-vercel-forwarded-for over a client-spoofable x-forwarded-for", () => {
    // A client can prepend its own x-forwarded-for entry; only the Vercel-set
    // headers reflect the true peer. The spoofed value must not pick the bucket.
    expect(
      clientKey(
        h({ "x-vercel-forwarded-for": "5.5.5.5", "x-forwarded-for": "1.2.3.4" }),
        "login"
      )
    ).toBe("login:5.5.5.5");
  });

  it("trusts x-real-ip over x-forwarded-for when both are present", () => {
    expect(
      clientKey(h({ "x-real-ip": "5.6.7.8", "x-forwarded-for": "1.2.3.4" }), "login")
    ).toBe("login:5.6.7.8");
  });

  it("buckets everyone together under 'unknown' when no IP header (fail closed)", () => {
    expect(clientKey(h({}), "apply")).toBe("apply:unknown");
  });

  it("namespaces by prefix so apply and login budgets are independent", () => {
    const headers = h({ "x-forwarded-for": "1.2.3.4" });
    expect(clientKey(headers, "apply")).not.toBe(clientKey(headers, "login"));
  });
});

describe("APPLY_RATE_LIMIT", () => {
  it("allows 10 applications per IP per hour", () => {
    expect(APPLY_RATE_LIMIT.maxAttempts).toBe(10);
    expect(APPLY_RATE_LIMIT.windowMs).toBe(60 * 60 * 1000);
  });
});

describe("emailKey", () => {
  it("normalizes case and surrounding whitespace so one account is one bucket", () => {
    expect(emailKey("  Admin@Example.COM ")).toBe("login-email:admin@example.com");
  });

  it("namespaces apart from the per-IP login budget so the two don't share a counter", () => {
    expect(emailKey("a@b.com")).not.toBe(clientKey(new Headers({ "x-real-ip": "a@b.com" }), "login"));
    expect(emailKey("a@b.com").startsWith("login-email:")).toBe(true);
  });
});

describe("LOGIN_EMAIL_RATE_LIMIT", () => {
  it("allows 10 failed attempts per account per 15 minutes", () => {
    expect(LOGIN_EMAIL_RATE_LIMIT.maxAttempts).toBe(10);
    expect(LOGIN_EMAIL_RATE_LIMIT.windowMs).toBe(15 * 60 * 1000);
  });
});

// DB-backed, like the other use-case suites: skip when no Postgres is reachable.
let dbReady = false;
try {
  await prisma.$queryRaw`SELECT 1`;
  dbReady = true;
} catch {
  dbReady = false;
}

const suite = dbReady ? describe : describe.skip;

const cfg: RateLimitConfig = { maxAttempts: 3, windowMs: 10_000 };
const KEY = "login:test-ip";

afterAll(async () => {
  await prisma.$disconnect().catch(() => {});
});

beforeEach(async () => {
  if (dbReady) await prisma.loginAttempt.deleteMany();
});

suite("login rate limiting", () => {
  it("allows attempts below the threshold and counts remaining", async () => {
    const first = await checkRateLimit(KEY, cfg);
    expect(first).toEqual({ blocked: false, remaining: 3 });

    await recordFailure(KEY, cfg);
    await recordFailure(KEY, cfg);
    const after = await checkRateLimit(KEY, cfg);
    expect(after).toEqual({ blocked: false, remaining: 1 });
  });

  it("blocks once the threshold is reached", async () => {
    await recordFailure(KEY, cfg);
    await recordFailure(KEY, cfg);
    await recordFailure(KEY, cfg);

    const result = await checkRateLimit(KEY, cfg);
    expect(result.blocked).toBe(true);
    if (result.blocked) {
      expect(result.retryAfterMs).toBeGreaterThan(0);
      expect(result.retryAfterMs).toBeLessThanOrEqual(cfg.windowMs);
    }
  });

  it("ignores attempts that have aged out of the window", async () => {
    // Three failures, but evaluated far enough in the future that they expired.
    await recordFailure(KEY, cfg);
    await recordFailure(KEY, cfg);
    await recordFailure(KEY, cfg);

    const future = new Date(Date.now() + cfg.windowMs + 1000);
    const result = await checkRateLimit(KEY, cfg, future);
    expect(result).toEqual({ blocked: false, remaining: 3 });
  });

  it("clearAttempts resets the counter after a successful login", async () => {
    await recordFailure(KEY, cfg);
    await recordFailure(KEY, cfg);
    await recordFailure(KEY, cfg);
    expect((await checkRateLimit(KEY, cfg)).blocked).toBe(true);

    await clearAttempts(KEY);
    expect(await checkRateLimit(KEY, cfg)).toEqual({ blocked: false, remaining: 3 });
  });

  it("scopes limits per key", async () => {
    await recordFailure("login:a", cfg);
    await recordFailure("login:a", cfg);
    await recordFailure("login:a", cfg);

    expect((await checkRateLimit("login:a", cfg)).blocked).toBe(true);
    expect(await checkRateLimit("login:b", cfg)).toEqual({ blocked: false, remaining: 3 });
  });
});

suite("consumeAttempt (atomic check-and-record)", () => {
  it("allows up to the threshold, then blocks", async () => {
    expect((await consumeAttempt(KEY, cfg)).blocked).toBe(false);
    expect((await consumeAttempt(KEY, cfg)).blocked).toBe(false);
    expect((await consumeAttempt(KEY, cfg)).blocked).toBe(false);
    const fourth = await consumeAttempt(KEY, cfg);
    expect(fourth.blocked).toBe(true);
    if (fourth.blocked) expect(fourth.retryAfterMs).toBeGreaterThan(0);
  });

  it("reports the remaining budget as it counts down", async () => {
    expect(await consumeAttempt(KEY, cfg)).toEqual({ blocked: false, remaining: 2 });
    expect(await consumeAttempt(KEY, cfg)).toEqual({ blocked: false, remaining: 1 });
    expect(await consumeAttempt(KEY, cfg)).toEqual({ blocked: false, remaining: 0 });
  });

  // The reason consumeAttempt exists: under concurrency it must never let more
  // than maxAttempts through. checkRateLimit + recordFailure would leak here.
  it("never lets more than maxAttempts through under concurrent calls", async () => {
    const results = await Promise.all(
      Array.from({ length: 12 }, () => consumeAttempt(KEY, cfg))
    );
    const allowed = results.filter((r) => !r.blocked).length;
    expect(allowed).toBe(cfg.maxAttempts);
  });

  // Regression guard for the live finding: with a trusted Vercel header present,
  // rotating a client-spoofable x-forwarded-for must resolve to ONE bucket and
  // still block after the budget — it cannot be used to walk past the limit.
  it("a rotating spoofed x-forwarded-for cannot mint fresh buckets past the limit", async () => {
    const keys = Array.from({ length: 6 }, (_, i) =>
      clientKey(
        new Headers({ "x-vercel-forwarded-for": "100.64.0.9", "x-forwarded-for": `198.51.100.${i}` }),
        "login"
      )
    );
    expect(new Set(keys).size).toBe(1); // spoofed XFF ignored: same bucket every time

    const results = [];
    for (const k of keys) results.push(await consumeAttempt(k, cfg));
    expect(results.filter((r) => !r.blocked).length).toBe(cfg.maxAttempts);
  });

  it("does not record an attempt once blocked", async () => {
    await consumeAttempt(KEY, cfg);
    await consumeAttempt(KEY, cfg);
    await consumeAttempt(KEY, cfg);
    await consumeAttempt(KEY, cfg); // blocked, must not insert
    await consumeAttempt(KEY, cfg); // blocked, must not insert
    const rows = await prisma.loginAttempt.count({ where: { key: KEY } });
    expect(rows).toBe(cfg.maxAttempts);
  });
});
