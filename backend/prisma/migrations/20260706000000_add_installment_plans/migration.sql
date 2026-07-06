-- CreateEnum
CREATE TYPE "PlanDirection" AS ENUM ('DEBT', 'CREDIT');

-- CreateEnum
CREATE TYPE "InstallmentPlanStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED');

-- AlterTable
ALTER TABLE "planned_transactions" ADD COLUMN     "counterparty" TEXT,
ADD COLUMN     "planId" TEXT;

-- CreateTable
CREATE TABLE "installment_plans" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "direction" "PlanDirection" NOT NULL,
    "title" TEXT NOT NULL,
    "totalAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "categoryId" TEXT,
    "accountId" TEXT,
    "ccAccountId" TEXT,
    "status" "InstallmentPlanStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "installment_plans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "installment_plans_userId_status_idx" ON "installment_plans"("userId", "status");

-- CreateIndex
CREATE INDEX "planned_transactions_planId_idx" ON "planned_transactions"("planId");

-- AddForeignKey
ALTER TABLE "planned_transactions" ADD CONSTRAINT "planned_transactions_planId_fkey" FOREIGN KEY ("planId") REFERENCES "installment_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "installment_plans" ADD CONSTRAINT "installment_plans_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "installment_plans" ADD CONSTRAINT "installment_plans_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "installment_plans" ADD CONSTRAINT "installment_plans_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "installment_plans" ADD CONSTRAINT "installment_plans_ccAccountId_fkey" FOREIGN KEY ("ccAccountId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
