import { prisma } from "@/lib/prisma";

export async function resetDb() {
  await prisma.application.deleteMany();
  await prisma.adminUser.deleteMany();
}
