import { Prisma } from '@prisma/client';
import prisma from './prisma';

// Eliminata la transazione che aveva saldato una pianificata / una o più rate:
// le scadenze tornano da pagare e un piano COMPLETED torna ACTIVE.
// Le scadenze pagate prima di paidTransactionId si riconoscono solo dalla prima
// (fromPlannedId). Ritorna true se ha riaperto qualcosa.
export async function rollbackPlannedPayment(
  userId: string,
  deleted: { id: string; fromPlannedId: string | null },
  db: Prisma.TransactionClient = prisma,
): Promise<boolean> {
  let paid = await db.plannedTransaction.findMany({
    where: { userId, isPaid: true, paidTransactionId: deleted.id },
    select: { id: true, planId: true },
  });
  if (paid.length === 0 && deleted.fromPlannedId) {
    paid = await db.plannedTransaction.findMany({
      where: { id: deleted.fromPlannedId, userId, isPaid: true, paidTransactionId: null },
      select: { id: true, planId: true },
    });
  }
  if (paid.length === 0) return false;

  await db.plannedTransaction.updateMany({
    where: { id: { in: paid.map((p) => p.id) } },
    data: { isPaid: false, paidTransactionId: null },
  });

  const planIds = [...new Set(paid.map((p) => p.planId).filter((id): id is string => !!id))];
  if (planIds.length > 0) {
    await db.installmentPlan.updateMany({
      where: { id: { in: planIds }, userId, status: 'COMPLETED' },
      data: { status: 'ACTIVE' },
    });
  }
  return true;
}
