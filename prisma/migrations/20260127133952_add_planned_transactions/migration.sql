-- CreateTable
CREATE TABLE "planned_transactions" (
    "id" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "type" "TransactionType" NOT NULL,
    "description" TEXT NOT NULL,
    "categoryId" TEXT,
    "plannedDate" TIMESTAMP(3) NOT NULL,
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "planned_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "planned_transactions_userId_plannedDate_idx" ON "planned_transactions"("userId", "plannedDate");

-- CreateIndex
CREATE INDEX "planned_transactions_userId_isPaid_idx" ON "planned_transactions"("userId", "isPaid");

-- AddForeignKey
ALTER TABLE "planned_transactions" ADD CONSTRAINT "planned_transactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planned_transactions" ADD CONSTRAINT "planned_transactions_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
