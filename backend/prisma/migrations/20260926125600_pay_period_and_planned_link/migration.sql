-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "fromPlannedId" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "payDay" INTEGER,
ADD COLUMN     "salaryCategoryId" TEXT;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_salaryCategoryId_fkey" FOREIGN KEY ("salaryCategoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
