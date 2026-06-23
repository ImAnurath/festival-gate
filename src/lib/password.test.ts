import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { hashPassword, verifyPassword } from "./password";

// Pure crypto, no DB: always runs.
describe("password hashing", () => {
  it("produces a salted scrypt string, never the bare password", () => {
    const h = hashPassword("hunter2");
    expect(h.startsWith("scrypt$")).toBe(true);
    expect(h).not.toContain("hunter2");
  });

  it("uses a random salt so two hashes of the same password differ", () => {
    expect(hashPassword("same")).not.toBe(hashPassword("same"));
  });

  it("verifies a correct password against a scrypt hash", () => {
    const h = hashPassword("correct horse");
    expect(verifyPassword("correct horse", h)).toEqual({ ok: true, needsUpgrade: false });
  });

  it("rejects a wrong password against a scrypt hash", () => {
    const h = hashPassword("correct horse");
    expect(verifyPassword("wrong", h).ok).toBe(false);
  });

  it("accepts a legacy unsalted SHA-256 hash and flags it for upgrade", () => {
    const legacy = createHash("sha256").update("oldpw").digest("hex");
    expect(verifyPassword("oldpw", legacy)).toEqual({ ok: true, needsUpgrade: true });
  });

  it("rejects a wrong password against a legacy hash", () => {
    const legacy = createHash("sha256").update("oldpw").digest("hex");
    expect(verifyPassword("nope", legacy).ok).toBe(false);
  });

  it("does not crash on a malformed stored value", () => {
    expect(verifyPassword("x", "").ok).toBe(false);
    expect(verifyPassword("x", "scrypt$bad").ok).toBe(false);
  });
});
