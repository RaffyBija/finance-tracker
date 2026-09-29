-- CreateEnum
CREATE TYPE "CategoryNature" AS ENUM ('ESSENTIAL', 'DISCRETIONARY');

-- AlterTable
ALTER TABLE "categories" ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "nature" "CategoryNature",
ADD COLUMN     "parentId" TEXT,
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "systemKey" TEXT,
ADD COLUMN     "templateKey" TEXT;

-- CreateIndex
CREATE INDEX "categories_userId_parentId_idx" ON "categories"("userId", "parentId");

-- CreateIndex
CREATE UNIQUE INDEX "categories_userId_systemKey_key" ON "categories"("userId", "systemKey");

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- La categoria di sistema degli addebiti carta si riconosce per chiave, non per nome.
UPDATE "categories" SET "systemKey" = 'CARD_SETTLEMENT'
WHERE "isSystem" = true AND "name" = 'Pagamento Carta' AND "type" = 'EXPENSE';
