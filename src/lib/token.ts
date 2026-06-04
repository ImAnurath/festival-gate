import { randomBytes } from "node:crypto";

export function generatePayToken(): string {
  return randomBytes(32).toString("base64url");
}

export function expiryFromNow(hours: number, base: Date = new Date()): Date {
  return new Date(base.getTime() + hours * 60 * 60 * 1000);
}
