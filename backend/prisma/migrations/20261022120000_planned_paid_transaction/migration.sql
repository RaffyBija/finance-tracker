-- AlterTable
ALTER TABLE "planned_transactions" ADD COLUMN     "paidTransactionId" TEXT;

-- CreateIndex
CREATE INDEX "planned_transactions_paidTransactionId_idx" ON "planned_transactions"("paidTransactionId");

-- Backfill: pianificate singole già pagate (le rate pagate in blocco non sono ricostruibili)
UPDATE "planned_transactions" p
SET "paidTransactionId" = t."id"
FROM "transactions" t
WHERE p."isPaid" = true
  AND p."paidTransactionId" IS NULL
  AND p."planId" IS NULL
  AND t."fromPlannedId" = p."id";
