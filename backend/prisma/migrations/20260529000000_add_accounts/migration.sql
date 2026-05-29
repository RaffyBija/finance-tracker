-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('BANK', 'CREDIT_CARD');

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AccountType" NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#0d9488',
    "icon" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "openingBalance" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "creditLimit" DECIMAL(10,2),
    "billingDay" INTEGER,
    "linkedAccountId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "accounts_userId_idx" ON "accounts"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_userId_name_key" ON "accounts"("userId", "name");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_linkedAccountId_fkey"
    FOREIGN KEY ("linkedAccountId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Crea "Conto Principale" per ogni utente esistente
INSERT INTO "accounts" ("id", "userId", "name", "type", "color", "isDefault", "openingBalance", "updatedAt")
SELECT
    gen_random_uuid()::text,
    "id",
    'Conto Principale',
    'BANK'::"AccountType",
    '#0d9488',
    true,
    0,
    NOW()
FROM "users";

-- AlterTable transactions: aggiungi accountId
ALTER TABLE "transactions" ADD COLUMN "accountId" TEXT;

-- Backfill: assegna tutte le transazioni esistenti al conto default dell'utente
UPDATE "transactions" t
SET "accountId" = a."id"
FROM "accounts" a
WHERE a."userId" = t."userId" AND a."isDefault" = true;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_accountId_fkey"
    FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "transactions_userId_accountId_idx" ON "transactions"("userId", "accountId");

-- AlterTable recurring_transactions: aggiungi accountId
ALTER TABLE "recurring_transactions" ADD COLUMN "accountId" TEXT;

UPDATE "recurring_transactions" rt
SET "accountId" = a."id"
FROM "accounts" a
WHERE a."userId" = rt."userId" AND a."isDefault" = true;

-- AddForeignKey
ALTER TABLE "recurring_transactions" ADD CONSTRAINT "recurring_transactions_accountId_fkey"
    FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable planned_transactions: aggiungi accountId
ALTER TABLE "planned_transactions" ADD COLUMN "accountId" TEXT;

UPDATE "planned_transactions" pt
SET "accountId" = a."id"
FROM "accounts" a
WHERE a."userId" = pt."userId" AND a."isDefault" = true;

-- AddForeignKey
ALTER TABLE "planned_transactions" ADD CONSTRAINT "planned_transactions_accountId_fkey"
    FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
