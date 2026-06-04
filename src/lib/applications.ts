import { prisma } from "./prisma";
import { config } from "./config";
import { approve, reject, assertPayable } from "./state-machine";
import { generatePayToken, expiryFromNow } from "./token";

export type CreateInput = {
  name: string;
  email: string;
  socialTags: string;
  ticketQuantity: number;
  guestNames: string[];
};

export async function createApplication(input: CreateInput) {
  return prisma.application.create({
    data: {
      name: input.name,
      email: input.email,
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

export async function markPaidByToken(
  payToken: string,
  paymentRef: string,
  amount: number,
) {
  const app = await prisma.application.findUnique({ where: { payToken } });
  if (!app) throw new Error("Unknown payment token");
  assertPayable(
    {
      status: app.status as Parameters<typeof assertPayable>[0]["status"],
      payTokenExpiresAt: app.payTokenExpiresAt,
      paidAt: app.paidAt,
    },
    new Date(),
  );
  return prisma.application.update({
    where: { id: app.id },
    data: { status: "PAID", paymentRef, amount, paidAt: new Date() },
  });
}
