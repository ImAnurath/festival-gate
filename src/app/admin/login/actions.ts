"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import {
  consumeAttempt,
  clearAttempts,
  clientKey,
  emailKey,
  LOGIN_EMAIL_RATE_LIMIT,
} from "@/lib/rate-limit";
import { hashPassword, verifyPassword } from "@/lib/password";

// A throwaway scrypt hash, computed once at module load. We verify against it on
// the "no such admin" path so the response time doesn't reveal whether an email
// is registered (the real path spends ~the same time running scrypt).
const DUMMY_HASH = hashPassword("timing-equalizer-not-a-real-password");

// Shared "you're blocked" response for either rate-limit dimension (per-IP or
// per-account), with the wait rounded up to whole minutes.
function blockedResult(retryAfterMs: number): { error: string } {
  const minutes = Math.ceil(retryAfterMs / 60_000);
  return {
    error: `Çok fazla başarısız deneme. Lütfen ${minutes} dakika sonra tekrar deneyin.`,
  };
}

export async function login(_prev: { error: string }, formData: FormData) {
  const ipKey = clientKey(await headers(), "login");

  // Atomically consume one attempt up front: concurrent requests can't slip
  // past the limit, and a blocked caller records nothing. A genuine success
  // clears the key again below.
  const ipGate = await consumeAttempt(ipKey);
  if (ipGate.blocked) return blockedResult(ipGate.retryAfterMs);

  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  // Per-account gate, on top of the per-IP one above: bounds a distributed
  // (multi-IP) guessing run against one known admin address, which the per-IP
  // limit alone can't catch. Consumed after the IP gate so a single attacker is
  // already capped; a genuine success clears both keys below.
  const accountKey = emailKey(email);
  const accountGate = await consumeAttempt(accountKey, LOGIN_EMAIL_RATE_LIMIT);
  if (accountGate.blocked) return blockedResult(accountGate.retryAfterMs);

  const admin = await prisma.adminUser.findUnique({ where: { email } });
  if (!admin) {
    verifyPassword(password, DUMMY_HASH); // equalize timing; result ignored
    return { error: "E-posta veya parola hatalı" };
  }

  const { ok, needsUpgrade } = verifyPassword(password, admin.passwordHash);
  if (!ok) {
    return { error: "E-posta veya parola hatalı" };
  }

  // Transparently migrate a legacy unsalted SHA-256 hash to scrypt on first
  // valid login, so old admins are upgraded without a password reset.
  if (needsUpgrade) {
    await prisma.adminUser.update({
      where: { id: admin.id },
      data: { passwordHash: hashPassword(password) },
    });
  }

  await clearAttempts(ipKey);
  await clearAttempts(accountKey);
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
