"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { consumeAttempt, clearAttempts, clientKey } from "@/lib/rate-limit";
import { hashPassword, verifyPassword } from "@/lib/password";

// A throwaway scrypt hash, computed once at module load. We verify against it on
// the "no such admin" path so the response time doesn't reveal whether an email
// is registered (the real path spends ~the same time running scrypt).
const DUMMY_HASH = hashPassword("timing-equalizer-not-a-real-password");

export async function login(_prev: { error: string }, formData: FormData) {
  const key = clientKey(await headers(), "login");

  // Atomically consume one attempt up front: concurrent requests can't slip
  // past the limit, and a blocked caller records nothing. A genuine success
  // clears the key again below.
  const gate = await consumeAttempt(key);
  if (gate.blocked) {
    const minutes = Math.ceil(gate.retryAfterMs / 60_000);
    return {
      error: `Çok fazla başarısız deneme. Lütfen ${minutes} dakika sonra tekrar deneyin.`,
    };
  }

  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
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

  await clearAttempts(key);
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
