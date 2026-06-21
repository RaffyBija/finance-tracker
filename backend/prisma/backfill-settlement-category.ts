/**
 * Backfill della categoria di sistema "Pagamento Carta" sugli addebiti CC esistenti.
 *
 * Per ogni utente:
 *   1. Garantisce la categoria di sistema (ensureSettlementCategory).
 *   2. La assegna agli addebiti CC già presenti ma SENZA categoria:
 *      - PlannedTransaction di billing (ccAccountId valorizzato);
 *      - Transaction reali di saldo, riconoscibili dal pattern descrizione
 *        "Addebito % - %" (create da settleAccount).
 *
 * Idempotente: aggiorna solo le righe con categoryId null, quindi è sicuro da
 * rieseguire (una seconda esecuzione non trova più nulla da assegnare).
 *
 * Esecuzione:  npx ts-node prisma/backfill-settlement-category.ts
 */
import prisma from '../src/utils/prisma';
import { ensureSettlementCategory } from '../src/utils/settlementCategory';

async function main() {
  const users = await prisma.user.findMany({ select: { id: true, email: true } });
  console.log(`Trovati ${users.length} utenti.`);

  let totalPlanned = 0;
  let totalTx = 0;

  for (const user of users) {
    // Salta gli utenti che non hanno nessuna CC né addebiti: niente categoria di sistema.
    const hasCc = await prisma.account.count({ where: { userId: user.id, type: 'CREDIT_CARD' } });
    const hasSettlementTx = await prisma.transaction.count({
      where: { userId: user.id, type: 'EXPENSE', categoryId: null, description: { startsWith: 'Addebito ' } },
    });
    if (hasCc === 0 && hasSettlementTx === 0) continue;

    const settlementCategoryId = await ensureSettlementCategory(user.id);

    // 1. Pianificate di billing senza categoria
    const planned = await prisma.plannedTransaction.updateMany({
      where: { userId: user.id, ccAccountId: { not: null }, categoryId: null },
      data: { categoryId: settlementCategoryId },
    });

    // 2. Transazioni reali di saldo senza categoria (pattern descrizione)
    const tx = await prisma.transaction.updateMany({
      where: {
        userId: user.id,
        type: 'EXPENSE',
        categoryId: null,
        description: { startsWith: 'Addebito ' },
      },
      data: { categoryId: settlementCategoryId },
    });

    totalPlanned += planned.count;
    totalTx += tx.count;
    if (planned.count || tx.count) {
      console.log(`— ${user.email}: ${planned.count} pianificate, ${tx.count} transazioni aggiornate.`);
    }
  }

  console.log(`\nFatto. Pianificate: ${totalPlanned}, transazioni: ${totalTx}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
