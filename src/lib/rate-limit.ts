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

// Admin login, per-ACCOUNT dimension: 10 failed attempts per email per 15
// minutes, on top of the per-IP LOGIN_RATE_LIMIT. The per-IP limit alone can't
// stop a distributed (botnet) guessing run against one known admin address —
// each source IP gets its own budget — so this caps total guesses per account
// regardless of source. Deliberately more lenient than the per-IP limit (10 vs
// 5): the per-IP gate is the first wall for a single attacker, while this one
// only binds across many IPs, and a higher threshold keeps a fat-fingering
// admin (or shared door-staff device) from locking the real account out. The
// window is self-healing, so any lockout lifts in 15 minutes.
export const LOGIN_EMAIL_RATE_LIMIT: RateLimitConfig = {
  maxAttempts: 10,
  windowMs: 15 * 60 * 1000,
};

// Resolve a stable rate-limit key from request headers. Prefer the headers Vercel
// sets from the observed TCP peer (x-vercel-forwarded-for, then x-real-ip), which
// a client cannot forge. x-forwarded-for is only a last-resort fallback (e.g.
// local dev or a different host): a client can prepend its own entry, so trusting
// its first element would let an attacker rotate the value to mint a fresh bucket
// per request and walk straight past the limit. Falls back to a constant so a
// missing header buckets everyone together (fail closed) rather than disabling the
// limit. `prefix` namespaces independent budgets (e.g. "login" vs "apply").
export function clientKey(headers: Headers, prefix: string): string {
  const ip =
    headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip")?.trim() ||
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";
  return `${prefix}:${ip}`;
}

// Rate-limit key for the per-account login budget. Normalizes the email (trim +
// lowercase) so "Admin@x.com" and "admin@x.com " map to one bucket, and
// namespaces it apart from the per-IP "login:" keys.
export function emailKey(email: string): string {
  return `login-email:${email.trim().toLowerCase()}`;
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
