import { prisma } from "./prisma";
import { config } from "./config";
import { approve, reject } from "./state-machine";
import { generatePayToken, expiryFromNow } from "./token";

export type CreateInput = {
  name: string;
  email: string;
  phone?: string | null;
  socialTags: string;
  ticketQuantity: number;
  guestNames: string[];
};

export async function createApplication(input: CreateInput) {
  return prisma.application.create({
    data: {
      name: input.name,
      email: input.email,
      phone: input.phone ?? null,
      socialTags: input.socialTags,
      ticketQuantity: input.ticketQuantity,
      guestNames: JSON.stringify(input.guestNames),
    },
  });
}

export async function approveApplication(id: string) {
  const app = await prisma.application.findUniqueOrThrow({ where: { id } });
  const next = approve(app.status as Parameters<typeof approve>[0]);
  return prisma.application.update({
    where: { id },
    data: {
      status: next,
      payToken: generatePayToken(),
      payTokenExpiresAt: expiryFromNow(config.payTokenTtlHours),
    },
  });
}

export async function rejectApplication(id: string) {
  const app = await prisma.application.findUniqueOrThrow({ where: { id } });
  const next = reject(app.status as Parameters<typeof reject>[0]);
  return prisma.application.update({ where: { id }, data: { status: next } });
}

// Re-issue a fresh payment token + expiry for an already-approved application
// (resend a link, or replace one that expired). The previous link stops working.
export async function reissuePayLink(id: string) {
  const app = await prisma.application.findUniqueOrThrow({ where: { id } });
  if (app.status !== "APPROVED") {
    throw new Error("Yalnızca onaylanmış başvurular için bağlantı yenilenebilir");
  }
  return prisma.application.update({
    where: { id },
    data: {
      payToken: generatePayToken(),
      payTokenExpiresAt: expiryFromNow(config.payTokenTtlHours),
    },
  });
}

export async function markPaidByToken(payToken: string, paymentRef: string, amount: number) {
  const now = new Date();
  const result = await prisma.application.updateMany({
    where: {
      payToken,
      status: "APPROVED",
      paidAt: null,
      payTokenExpiresAt: { gt: now },
    },
    data: { status: "PAID", paymentRef, amount, paidAt: now },
  });
  if (result.count === 0) {
    throw new Error(
      "Application is not payable: unknown token, not approved, expired, or already paid"
    );
  }
  return prisma.application.findUniqueOrThrow({ where: { payToken } });
}
