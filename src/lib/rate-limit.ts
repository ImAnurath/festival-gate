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
