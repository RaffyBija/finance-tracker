/**
 * Backfill dei cicli di fatturazione per le CC già esistenti.
 *
 * Per ogni carta di credito:
 *   1. Ricostruisce un BillingCycle CLOSED per ogni PlannedTransaction di billing
 *      esistente (ccAccountId valorizzato), collegandola e usando la finestra del
 *      ciclo che si chiudeva al momento della sua creazione.
 *   2. Crea il ciclo OPEN corrente.
 *   3. Azzera openingBalance (prima conteneva lo storico collassato): ora il saldo
 *      carta si ri-deriva dal solo ciclo aperto e i cicli chiusi sono pianificate.
 *
 * Idempotente: usa upsert sullo unique [accountId, periodStart]. Sicuro da rieseguire.
 *
 * Esecuzione:  npx ts-node prisma/backfill-billing-cycles.ts
 */
import prisma from '../src/utils/prisma';
import {
  cycleWindowFor,
  effectiveClosingDay,
  ensureOpenCycle,
  nextBillingDate,
} from '../src/utils/billingCycle';

async function main() {
  const ccs = await prisma.account.findMany({ where: { type: 'CREDIT_CARD' } });
  console.log(`Trovate ${ccs.length} carte di credito.`);

  for (const cc of ccs) {
    const closingDay = effectiveClosingDay(cc);
    console.log(`\n— ${cc.name} (closingDay effettivo: ${closingDay})`);

    // 1. Ricostruisci i cicli CHIUSI dalle pianificate di billing esistenti
    const billingPlanned = await prisma.plannedTransaction.findMany({
      where: { ccAccountId: cc.id },
      orderBy: { createdAt: 'asc' },
    });

    for (const planned of billingPlanned) {
      // Il pagamento avviene DOPO la chiusura: il ciclo che salda è quello che si
      // chiude al closingDay precedente alla data di addebito. Partiamo dalla
      // finestra che contiene plannedDate e torniamo indietro di un ciclo.
      const ref = planned.plannedDate ?? planned.createdAt;
      const containing = cycleWindowFor(ref, closingDay);
      const beforeStart = new Date(containing.periodStart);
      beforeStart.setDate(beforeStart.getDate() - 1);
      const closeWin = cycleWindowFor(beforeStart, closingDay);
      const billingDate = planned.plannedDate ?? nextBillingDate(cc.billingDay ?? 15, closeWin.periodEnd);

      const cycle = await prisma.billingCycle.upsert({
        where: { accountId_periodStart: { accountId: cc.id, periodStart: closeWin.periodStart } },
        update: {
          status: 'CLOSED',
          closedAt: planned.createdAt,
          billingDate,
          debtAmount: planned.amount,
          plannedTransactionId: planned.id,
        },
        create: {
          userId: cc.userId,
          accountId: cc.id,
          periodStart: closeWin.periodStart,
          periodEnd: closeWin.periodEnd,
          status: 'CLOSED',
          closedAt: planned.createdAt,
          billingDate,
          debtAmount: planned.amount,
          plannedTransactionId: planned.id,
        },
      });
      console.log(
        `  ciclo CHIUSO ${closeWin.periodStart.toISOString().slice(0, 10)} → ` +
        `${closeWin.periodEnd.toISOString().slice(0, 10)} (€${Number(planned.amount)}) [${cycle.id.slice(0, 8)}]`,
      );
    }

    // 2. Crea il ciclo OPEN corrente
    const open = await ensureOpenCycle(cc.userId, cc);
    console.log(
      `  ciclo OPEN  ${open.periodStart.toISOString().slice(0, 10)} → ` +
      `${open.periodEnd.toISOString().slice(0, 10)}`,
    );

    // 3. Azzera openingBalance (storico ora nei cicli)
    if (Number(cc.openingBalance) !== 0) {
      await prisma.account.update({ where: { id: cc.id }, data: { openingBalance: 0 } });
      console.log(`  openingBalance azzerato (era €${Number(cc.openingBalance)})`);
    }
  }

  console.log('\nBackfill completato.');
}

main()
  .catch((e) => {
    console.error('Backfill error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
