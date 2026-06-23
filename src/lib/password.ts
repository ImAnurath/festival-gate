import { randomBytes, scryptSync, timingSafeEqual, createHash } from "node:crypto";

// Admin password hashing. New hashes use salted scrypt — a slow, memory-hard
// KDF built into Node, so no extra dependency and no native build on Vercel.
// Stored format: "scrypt$<saltHex>$<hashHex>".
//
// Legacy values are unsalted SHA-256 hex from before this change. verifyPassword
// still accepts them and flags them via `needsUpgrade` so the login flow can
// transparently re-hash to scrypt on the next successful sign-in.
const SCRYPT_PREFIX = "scrypt";
const KEY_LENGTH = 64;
const SALT_BYTES = 16;

export function hashPassword(password: string): string {
  const salt = randomBytes(SALT_BYTES);
  const derived = scryptSync(password, salt, KEY_LENGTH);
  return `${SCRYPT_PREFIX}$${salt.toString("hex")}$${derived.toString("hex")}`;
}

export type VerifyResult = {
  ok: boolean;
  /** True when `stored` was a legacy SHA-256 hash that verified: re-hash it. */
  needsUpgrade: boolean;
};

function safeEqual(a: Buffer, b: Buffer): boolean {
  return a.length > 0 && a.length === b.length && timingSafeEqual(a, b);
}

export function verifyPassword(password: string, stored: string): VerifyResult {
  if (stored.startsWith(`${SCRYPT_PREFIX}$`)) {
    const [, saltHex, hashHex] = stored.split("$");
    const expected = Buffer.from(hashHex ?? "", "hex");
    if (expected.length === 0) return { ok: false, needsUpgrade: false };
    const derived = scryptSync(password, Buffer.from(saltHex ?? "", "hex"), expected.length);
    return { ok: safeEqual(expected, derived), needsUpgrade: false };
  }
  // Legacy unsalted SHA-256 hex: verify in constant time, flag for upgrade.
  const legacy = createHash("sha256").update(password).digest();
  const ok = safeEqual(legacy, Buffer.from(stored, "hex"));
  return { ok, needsUpgrade: ok };
}
