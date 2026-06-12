import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { SHOWCASE_PAY_TOKEN } from "../src/lib/payment/showcase";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const farFuture = new Date("2100-01-01T00:00:00Z");
  await prisma.application.upsert({
    where: { payToken: SHOWCASE_PAY_TOKEN },
    update: {
      status: "APPROVED",
      payTokenExpiresAt: farFuture,
      paidAt: null,
      amount: null,
      paymentRef: null,
    },
    create: {
      name: "KİNDZİ FEST Demo",
      email: "demo@kindzifest.example",
      socialTags: "@kindzifest",
      ticketQuantity: 1,
      guestNames: "[]",
      guestSocials: "[]",
      childCount: 0,
      status: "APPROVED",
      payToken: SHOWCASE_PAY_TOKEN,
      payTokenExpiresAt: farFuture,
    },
  });
  console.log("Showcase application seeded:", SHOWCASE_PAY_TOKEN);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    return prisma.$disconnect().finally(() => process.exit(1));
  });
