import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";

export type AdminSession = { adminId?: string };

const options: SessionOptions = {
  password: process.env.SESSION_PASSWORD as string,
  cookieName: "festival_admin",
  cookieOptions: { secure: process.env.NODE_ENV === "production" },
};

export async function getSession() {
  return getIronSession<AdminSession>(await cookies(), options);
}

export async function requireAdmin(): Promise<string> {
  const session = await getSession();
  if (!session.adminId) throw new Error("UNAUTHORIZED");
  return session.adminId;
}
