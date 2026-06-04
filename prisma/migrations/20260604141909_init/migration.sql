-- CreateTable
CREATE TABLE "Application" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "socialTags" TEXT NOT NULL,
    "ticketQuantity" INTEGER NOT NULL,
    "guestNames" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "payToken" TEXT,
    "payTokenExpiresAt" DATETIME,
    "amount" INTEGER,
    "paymentRef" TEXT,
    "paidAt" DATETIME,
    "reviewNote" TEXT
);

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Application_payToken_key" ON "Application"("payToken");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_email_key" ON "AdminUser"("email");
