"use server";

import { redirect } from "next/navigation";
import { createHash, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

function hash(pw: string) {
  return createHash("sha256").update(pw).digest("hex");
}

export async function login(_prev: { error: string }, formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const admin = await prisma.adminUser.findUnique({ where: { email } });
  if (!admin) return { error: "E-posta veya parola hatalı" };

  const a = Buffer.from(hash(password));
  const b = Buffer.from(admin.passwordHash);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { error: "E-posta veya parola hatalı" };
  }

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
