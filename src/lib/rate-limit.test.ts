import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  checkRateLimit,
  recordFailure,
  clearAttempts,
  consumeAttempt,
  clientKey,
  APPLY_RATE_LIMIT,
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
