"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createHash, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { checkRateLimit, recordFailure, clearAttempts } from "@/lib/rate-limit";

function hash(pw: string) {
  return createHash("sha256").update(pw).digest("hex");
}

// Identify the caller for rate limiting. Behind Vercel the real client IP is the
// first entry of x-forwarded-for; fall back to x-real-ip, then a constant so a
// missing header buckets everyone together (fail closed) rather than disabling
// the limit entirely.
async function clientKey(): Promise<string> {
  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip")?.trim() ||
    "unknown";
  return `login:${ip}`;
}

export async function login(_prev: { error: string }, formData: FormData) {
  const key = await clientKey();

  const limit = await checkRateLimit(key);
  if (limit.blocked) {
    const minutes = Math.ceil(limit.retryAfterMs / 60_000);
    return {
      error: `Çok fazla başarısız deneme. Lütfen ${minutes} dakika sonra tekrar deneyin.`,
    };
  }

  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const admin = await prisma.adminUser.findUnique({ where: { email } });
  if (!admin) {
    await recordFailure(key);
    return { error: "E-posta veya parola hatalı" };
  }

  const a = Buffer.from(hash(password));
  const b = Buffer.from(admin.passwordHash);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    await recordFailure(key);
    return { error: "E-posta veya parola hatalı" };
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
