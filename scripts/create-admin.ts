import { createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

async function main() {
  const [email, password] = process.argv.slice(2);

  if (!email || !password) {
    console.error("Usage: npx tsx scripts/create-admin.ts <email> <password>");
    process.exit(1);
  }

  const url = process.env.DATABASE_URL ?? "file:./dev.db";
  const adapter = new PrismaBetterSqlite3({ url });
  const prisma = new PrismaClient({ adapter });

  await prisma.adminUser.upsert({
    where: { email },
    update: { passwordHash: createHash("sha256").update(password).digest("hex") },
    create: { email, passwordHash: createHash("sha256").update(password).digest("hex") },
  });
  console.log(`Admin ${email} ready.`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
