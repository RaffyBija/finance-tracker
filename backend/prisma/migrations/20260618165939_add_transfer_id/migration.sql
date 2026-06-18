-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "transferId" TEXT;

-- CreateIndex
CREATE INDEX "transactions_transferId_idx" ON "transactions"("transferId");
