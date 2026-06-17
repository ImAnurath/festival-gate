import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  checkRateLimit,
  recordFailure,
  clearAttempts,
  type RateLimitConfig,
} from "./rate-limit";

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
