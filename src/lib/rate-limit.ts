import { prisma } from "./prisma";

export type RateLimitConfig = {
  /** Max failed attempts allowed within the window before blocking. */
  maxAttempts: number;
  /** Rolling window length in milliseconds. */
  windowMs: number;
};

// Admin login: 5 failed attempts per client per 15 minutes. Conservative on
// purpose. A legitimate admin rarely fails this many times; a brute-force run
// hits the wall almost immediately.
export const LOGIN_RATE_LIMIT: RateLimitConfig = {
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000,
};

// Public application form: 10 submissions per client IP per hour. Lenient on
// purpose because Turkish mobile carriers use CGNAT, so many legitimate
// applicants share one public IP. A scripted flood from a single IP still hits
// the wall; a family on shared mobile data realistically never does.
export const APPLY_RATE_LIMIT: RateLimitConfig = {
  maxAttempts: 10,
  windowMs: 60 * 60 * 1000,
};

// Resolve a stable rate-limit key from request headers. Behind Vercel the real
// client IP is the first entry of x-forwarded-for; fall back to x-real-ip, then
// a constant so a missing header buckets everyone together (fail closed) rather
// than disabling the limit entirely. `prefix` namespaces independent budgets
// (e.g. "login" vs "apply") so they don't share a counter.
export function clientKey(headers: Headers, prefix: string): string {
  const ip =
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip")?.trim() ||
    "unknown";
  return `${prefix}:${ip}`;
}

export type RateLimitResult =
  | { blocked: false; remaining: number }
  | { blocked: true; retryAfterMs: number };

/**
 * Reports whether `key` has exceeded the failure budget inside the rolling
 * window. Read-only: it never records an attempt. Call {@link recordFailure}
 * after a genuinely failed login.
 */
export async function checkRateLimit(
  key: string,
  cfg: RateLimitConfig = LOGIN_RATE_LIMIT,
  now: Date = new Date()
): Promise<RateLimitResult> {
  const windowStart = new Date(now.getTime() - cfg.windowMs);
  const attempts = await prisma.loginAttempt.findMany({
    where: { key, createdAt: { gte: windowStart } },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true },
  });

  if (attempts.length >= cfg.maxAttempts) {
    // The block lifts once the oldest in-window attempt ages out.
    const oldest = attempts[0].createdAt;
    const retryAfterMs = Math.max(oldest.getTime() + cfg.windowMs - now.getTime(), 0);
    return { blocked: true, retryAfterMs };
  }
  return { blocked: false, remaining: cfg.maxAttempts - attempts.length };
}

/**
 * Records one failed attempt for `key` and opportunistically prunes that key's
 * attempts that have aged out of the window, so the table cannot grow unbounded.
 */
export async function recordFailure(
  key: string,
  cfg: RateLimitConfig = LOGIN_RATE_LIMIT,
  now: Date = new Date()
): Promise<void> {
  await prisma.loginAttempt.create({ data: { key } });
  await prisma.loginAttempt.deleteMany({
    where: { key, createdAt: { lt: new Date(now.getTime() - cfg.windowMs) } },
  });
}

/** Clears all recorded attempts for `key` (call after a successful login). */
export async function clearAttempts(key: string): Promise<void> {
  await prisma.loginAttempt.deleteMany({ where: { key } });
}

/**
 * Atomically evaluate AND consume one attempt for `key` in a single locked
 * transaction. Unlike {@link checkRateLimit} + {@link recordFailure} (two
 * round-trips with a check-then-act gap that concurrent callers can slip
 * through), this takes a Postgres transaction-scoped advisory lock on the key,
 * so simultaneous attempts are serialized: once the window is full the next
 * caller is blocked with no over-budget leak. Used by admin login, where a
 * genuine success then clears the key. When blocked, nothing is recorded.
 */
export async function consumeAttempt(
  key: string,
  cfg: RateLimitConfig = LOGIN_RATE_LIMIT,
  now: Date = new Date()
): Promise<RateLimitResult> {
  const windowStart = new Date(now.getTime() - cfg.windowMs);
  return prisma.$transaction(async (tx) => {
    // Serialize all rate-limit decisions for this key; the lock releases on
    // commit/rollback. hashtext maps the string key to the int the lock takes.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
    const attempts = await tx.loginAttempt.findMany({
      where: { key, createdAt: { gte: windowStart } },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    });
    if (attempts.length >= cfg.maxAttempts) {
      const oldest = attempts[0].createdAt;
      const retryAfterMs = Math.max(oldest.getTime() + cfg.windowMs - now.getTime(), 0);
      return { blocked: true, retryAfterMs };
    }
    await tx.loginAttempt.create({ data: { key } });
    await tx.loginAttempt.deleteMany({ where: { key, createdAt: { lt: windowStart } } });
    return { blocked: false, remaining: cfg.maxAttempts - attempts.length - 1 };
  });
}
