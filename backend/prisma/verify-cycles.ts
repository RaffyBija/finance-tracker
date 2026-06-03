/**
 * Verifica end-to-end della logica cicli su un utente di test isolato.
 * Crea i dati, esercita gli scenari retroattivi, stampa PASS/FAIL, poi elimina
 * l'utente di test (cascade). NON tocca i dati reali.
 *
 *   npx ts-node prisma/verify-cycles.ts
 */
import prisma from '../src/utils/prisma';
import {
  cycleWindowFor,
  computeCycleDebt,
  ensureOpenCycle,
  syncCyclePlanned,
  reconcileCcChanges,
  debtContribution,
} from '../src/utils/billingCycle';

const NOW = new Date('2026-06-03T12:00:00');
let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail = '') {
  if (cond) { passed++; console.log(`  ✅ ${name}`); }
  else { failed++; console.log(`  ❌ ${name} ${detail}`); }
}

async function main() {
  // Pulisci eventuale run precedente
  await prisma.user.deleteMany({ where: { email: 'cycle-test@example.com' } });

  const user = await prisma.user.create({
    data: { email: 'cycle-test@example.com', password: 'x', name: 'Cycle Test' },
  });
  const bank = await prisma.account.create({
    data: { userId: user.id, name: 'Bank', type: 'BANK', openingBalance: 1000 },
  });
  const cc = await prisma.account.create({
    data: {
      userId: user.id, name: 'CC Test', type: 'CREDIT_CARD',
      openingBalance: 0, billingDay: 20, closingDay: 15, linkedAccountId: bank.id,
    },
  });

  const mkTx = (date: string, amount: number, type: 'INCOME' | 'EXPENSE' = 'EXPENSE') =>
    prisma.transaction.create({ data: { userId: user.id, accountId: cc.id, amount, type, date: new Date(date) } });

  // Spese: ciclo 16/04–15/05 (chiuso) e ciclo 16/05–15/06 (aperto)
  await mkTx('2026-05-05T12:00:00', 100); // ciclo da chiudere
  await mkTx('2026-05-29T12:00:00', 50);  // ciclo aperto

  // Chiudi il ciclo 16/04–15/05
  const closeWin = cycleWindowFor(new Date('2026-05-15T12:00:00'), 15);
  const debtClosed = await computeCycleDebt(cc.id, closeWin.periodStart, closeWin.periodEnd);
  check('debito ciclo chiuso = 100', debtClosed === 100, `(got ${debtClosed})`);

  const closedCycle = await prisma.billingCycle.create({
    data: {
      userId: user.id, accountId: cc.id,
      periodStart: closeWin.periodStart, periodEnd: closeWin.periodEnd,
      status: 'CLOSED', closedAt: NOW,
    },
  });
  await syncCyclePlanned(closedCycle, { ...cc }, debtClosed);
  await ensureOpenCycle(user.id, cc, NOW);

  let planned = await prisma.plannedTransaction.findFirst({ where: { ccAccountId: cc.id } });
  check('pianificata creata = 100', Number(planned?.amount) === 100, `(got ${planned?.amount})`);

  // Saldo ciclo aperto = 50 (solo la spesa del 29/05)
  const openWin = cycleWindowFor(NOW, 15);
  let openDebt = await computeCycleDebt(cc.id, openWin.periodStart, openWin.periodEnd);
  check('debito ciclo aperto = 50', openDebt === 50, `(got ${openDebt})`);

  // ── TEST A: transazione retroattiva nel ciclo CHIUSO NON pagato ─────────────
  const txA = await mkTx('2026-05-10T12:00:00', 30);
  await reconcileCcChanges(user.id, [{
    accountId: cc.id, date: txA.date, signed: debtContribution('EXPENSE', 30),
  }], NOW);
  planned = await prisma.plannedTransaction.findUnique({ where: { id: planned!.id } });
  check('A) pianificata ciclo chiuso aggiornata a 130', Number(planned?.amount) === 130, `(got ${planned?.amount})`);
  openDebt = await computeCycleDebt(cc.id, openWin.periodStart, openWin.periodEnd);
  check('A) ciclo aperto invariato = 50', openDebt === 50, `(got ${openDebt})`);

  // ── TEST B: transazione retroattiva nel ciclo CHIUSO GIÀ pagato → conguaglio ─
  await prisma.plannedTransaction.update({ where: { id: planned!.id }, data: { isPaid: true } });
  const txB = await mkTx('2026-05-08T12:00:00', 20);
  await reconcileCcChanges(user.id, [{
    accountId: cc.id, date: txB.date, signed: debtContribution('EXPENSE', 20),
  }], NOW);

  const plannedAfter = await prisma.plannedTransaction.findUnique({ where: { id: planned!.id } });
  check('B) pianificata pagata invariata = 130', Number(plannedAfter?.amount) === 130, `(got ${plannedAfter?.amount})`);

  const conguaglio = await prisma.transaction.findFirst({
    where: { accountId: cc.id, description: { contains: 'Conguaglio' } },
  });
  check('B) conguaglio creato = 20 EXPENSE', Number(conguaglio?.amount) === 20 && conguaglio?.type === 'EXPENSE', `(got ${conguaglio?.amount}/${conguaglio?.type})`);
  check('B) conguaglio nel ciclo aperto', !!conguaglio && conguaglio.date >= openWin.periodStart && conguaglio.date <= openWin.periodEnd);

  openDebt = await computeCycleDebt(cc.id, openWin.periodStart, openWin.periodEnd);
  check('B) ciclo aperto ora = 70 (50 + conguaglio 20)', openDebt === 70, `(got ${openDebt})`);

  // Pulizia
  await prisma.user.delete({ where: { id: user.id } });

  console.log(`\nRisultato: ${passed} PASS, ${failed} FAIL`);
  if (failed > 0) process.exitCode = 1;
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
