-- Idempotent: production drifted (childCount/guestSocials were added via db push
-- without a migration), so every statement guards against pre-existing objects.

-- CreateEnum (guarded: CREATE TYPE has no IF NOT EXISTS)
DO $$ BEGIN
  CREATE TYPE "TicketStatus" AS ENUM ('VALID', 'USED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- AlterTable
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "childCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "guestSocials" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "ticketsAccessToken" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "Ticket" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "holderName" TEXT NOT NULL,
    "isBuyer" BOOLEAN NOT NULL DEFAULT false,
    "code" TEXT NOT NULL,
    "verifyToken" TEXT NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'VALID',
    "checkedInAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "LoginAttempt" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Ticket_code_key" ON "Ticket"("code");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Ticket_verifyToken_key" ON "Ticket"("verifyToken");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Ticket_applicationId_idx" ON "Ticket"("applicationId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "LoginAttempt_key_createdAt_idx" ON "LoginAttempt"("key", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Application_ticketsAccessToken_key" ON "Application"("ticketsAccessToken");

-- AddForeignKey (guarded: ADD CONSTRAINT has no IF NOT EXISTS)
DO $$ BEGIN
  ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
