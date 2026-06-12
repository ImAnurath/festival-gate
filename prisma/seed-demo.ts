// Demo / test data seed: a few sample applications (and optionally an admin)
// so the apply -> approve -> pay flow can be clicked through on a fresh database.
//
// USAGE:
//   npx tsx prisma/seed-demo.ts                      # applications only
//   npx tsx prisma/seed-demo.ts <adminEmail> <pw>    # also create/update an admin
//
// Depends only on DATABASE_URL (and optionally TICKET_PRICE). It is idempotent:
// it deletes any previous demo rows (matched by their demo emails) before reseeding.
//
// WARNING: the demo applications are TEST DATA. If you run this against the
// production database, delete these rows before the real event.

import { createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { generatePayToken, expiryFromNow } from "../src/lib/token";

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

const DEMO_EMAILS = [
  "demo-pending@kindzifest.example",
  "demo-approved@kindzifest.example",
  "demo-paid@kindzifest.example",
];

async function main() {
  const [adminEmail, adminPassword] = process.argv.slice(2);

  const ticketPrice = Number(process.env.TICKET_PRICE ?? "500");
  const linkTtlHours = 720; // 30 days, so the demo pay link stays usable while testing

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  // Idempotent: clear previous demo rows so re-running gives a clean set.
  await prisma.application.deleteMany({ where: { email: { in: DEMO_EMAILS } } });

  // 1) PENDING — waiting for the commissioner's manual approval.
  await prisma.application.create({
    data: {
      name: "Demo Bekleyen",
      email: DEMO_EMAILS[0],
      socialTags: "@demo_pending",
      ticketQuantity: 1,
      guestNames: "[]",
      guestSocials: "[]",
      childCount: 0,
      status: "PENDING",
    },
  });

  // 2) APPROVED — has a real pay link you can open at /pay/<token>.
  const approvedToken = generatePayToken();
  await prisma.application.create({
    data: {
      name: "Demo Onaylı",
      email: DEMO_EMAILS[1],
      socialTags: "@demo_approved",
      ticketQuantity: 2,
      guestNames: JSON.stringify(["Demo Misafir"]),
      guestSocials: JSON.stringify(["@demo_guest"]),
      childCount: 1,
      status: "APPROVED",
      payToken: approvedToken,
      payTokenExpiresAt: expiryFromNow(linkTtlHours),
    },
  });

  // 3) PAID — already completed, for display in the admin panel.
  await prisma.application.create({
    data: {
      name: "Demo Ödenmiş",
      email: DEMO_EMAILS[2],
      socialTags: "@demo_paid",
      ticketQuantity: 1,
      guestNames: "[]",
      guestSocials: "[]",
      childCount: 0,
      status: "PAID",
      payToken: generatePayToken(),
      payTokenExpiresAt: expiryFromNow(linkTtlHours),
      amount: 1 * ticketPrice,
      paymentRef: "seed_demo",
      paidAt: new Date(),
    },
  });

  console.log("Demo applications seeded (3): PENDING, APPROVED, PAID.");
  console.log(`Approved applicant pay link: /pay/${approvedToken}`);

  if (adminEmail && adminPassword) {
    await prisma.adminUser.upsert({
      where: { email: adminEmail },
      update: { passwordHash: sha256(adminPassword) },
      create: { email: adminEmail, passwordHash: sha256(adminPassword) },
    });
    console.log(`Admin ${adminEmail} ready.`);
  } else {
    console.log(
      "No admin args given. To add an admin: npx tsx prisma/seed-demo.ts <email> <password>"
    );
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
