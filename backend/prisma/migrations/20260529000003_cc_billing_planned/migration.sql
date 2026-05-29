ALTER TABLE "planned_transactions" ADD COLUMN "ccAccountId" TEXT;
ALTER TABLE "planned_transactions" ADD CONSTRAINT "planned_transactions_ccAccountId_fkey"
  FOREIGN KEY ("ccAccountId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
