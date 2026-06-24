import { randomBytes } from "node:crypto";

export function generatePayToken(): string {
  return randomBytes(32).toString("base64url");
}

export function expiryFromNow(hours: number, base: Date = new Date()): Date {
  return new Date(base.getTime() + hours * 60 * 60 * 1000);
}

// Short reference shown to the buyer to write in a Havale/EFT transfer
// description, and shown per-booking in the admin table so the organizer can
// match an incoming transfer to a booking. Derived from the payToken; base64url
// "-"/"_" are stripped so it is plain A-Z/0-9 with no symbols to mistype.
export function havaleReference(payToken: string): string {
  return payToken.replace(/[^a-zA-Z0-9]/g, "").slice(0, 6).toUpperCase();
}

// Opaque QR payload. 16 bytes (128 bits) is ample and keeps the QR dense.
export function generateVerifyToken(): string {
  return randomBytes(16).toString("base64url");
}

// Short, human-readable ticket code, e.g. "KF-7Q4X2". The alphabet omits
// 0/O/1/I/L to avoid misreads when read aloud at the door.
const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export function generateTicketCode(): string {
  let body = "";
  const bytes = randomBytes(5);
  for (let i = 0; i < 5; i++) {
    body += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return `KF-${body}`;
}
