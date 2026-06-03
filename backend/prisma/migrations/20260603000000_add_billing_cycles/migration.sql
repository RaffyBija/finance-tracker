-- CreateEnum
CREATE TYPE "CycleStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateTable
CREATE TABLE "billing_cycles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "status" "CycleStatus" NOT NULL DEFAULT 'OPEN',
    "closedAt" TIMESTAMP(3),
    "billingDate" TIMESTAMP(3),
    "debtAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "plannedTransactionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "billing_cycles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "billing_cycles_plannedTransactionId_key" ON "billing_cycles"("plannedTransactionId");

-- CreateIndex
CREATE INDEX "billing_cycles_userId_accountId_idx" ON "billing_cycles"("userId", "accountId");

-- CreateIndex
CREATE INDEX "billing_cycles_accountId_status_idx" ON "billing_cycles"("accountId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "billing_cycles_accountId_periodStart_key" ON "billing_cycles"("accountId", "periodStart");

-- AddForeignKey
ALTER TABLE "billing_cycles" ADD CONSTRAINT "billing_cycles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_cycles" ADD CONSTRAINT "billing_cycles_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_cycles" ADD CONSTRAINT "billing_cycles_plannedTransactionId_fkey" FOREIGN KEY ("plannedTransactionId") REFERENCES "planned_transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
