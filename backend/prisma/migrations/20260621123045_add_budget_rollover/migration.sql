-- CreateEnum
CREATE TYPE "BudgetRollover" AS ENUM ('NONE', 'SURPLUS', 'FULL');

-- AlterTable
ALTER TABLE "budgets" ADD COLUMN     "rollover" "BudgetRollover" NOT NULL DEFAULT 'NONE';
