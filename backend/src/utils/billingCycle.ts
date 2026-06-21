import prisma from './prisma';
import { ensureSettlementCategory } from './settlementCategory';

// Prossima data di addebito (billingDay) a partire da `from`, con clamping per
// i mesi corti (es. billingDay 31 → ultimo giorno del mese).
export function nextBillingDate(billingDay: number, from: Date): Date {
  const build = (year: number, month: number) => {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return new Date(year, month, Math.min(billingDay, daysInMonth));
  };

  let candidate = build(from.getFullYear(), from.getMonth());
  if (candidate < from) {
    candidate = build(from.getFullYear(), from.getMonth() + 1);
  }
  return candidate;
}

// ── Cicli di fatturazione delle carte di credito ────────────────────────────────
//
//   Principio guida: l'appartenenza di una transazione a un ciclo è una FUNZIONE
//   DETERMINISTICA della sua data e del closingDay della carta. Il debito di ogni
//   ciclo è sempre ri-derivabile dalle transazioni nella sua finestra
//   [periodStart, periodEnd]. Così inserimenti e modifiche retroattive finiscono
//   nel ciclo corretto, invece di "perdersi" nel ciclo corrente.
//
//   Convenzione finestra: il ciclo "chiude" il giorno closingDay (incluso). Una
//   transazione fatta il giorno closingDay appartiene al ciclo che chiude quel
//   giorno; dal giorno dopo inizia il ciclo successivo.

export interface CycleWindow {
  periodStart: Date; // 00:00:00.000 del primo giorno del ciclo
  periodEnd: Date;   // 23:59:59.999 del giorno di chiusura (incluso)
}

// closingDay effettivo: se non configurato si ricade su billingDay, poi su 1.
export function effectiveClosingDay(account: {
  closingDay: number | null;
  billingDay: number | null;
}): number {
  return account.closingDay ?? account.billingDay ?? 1;
}

function clampDayStart(year: number, month: number, day: number): Date {
  const lastDay = new Date(year, month + 1, 0).getDate();
  const d = new Date(year, month, Math.min(day, lastDay));
  d.setHours(0, 0, 0, 0);
  return d;
}

function clampDayEnd(year: number, month: number, day: number): Date {
  const lastDay = new Date(year, month + 1, 0).getDate();
  const d = new Date(year, month, Math.min(day, lastDay));
  d.setHours(23, 59, 59, 999);
  return d;
}

// Finestra del ciclo a cui appartiene `date`, dato il closingDay della carta.
export function cycleWindowFor(date: Date, closingDay: number): CycleWindow {
  const d = new Date(date);

  // Confine di chiusura del mese di `date`
  const endThisMonth = clampDayEnd(d.getFullYear(), d.getMonth(), closingDay);

  // Se `date` è ≤ chiusura del suo mese → appartiene al ciclo che chiude questo
  // mese; altrimenti al ciclo che chiude il mese successivo.
  const periodEnd = d <= endThisMonth
    ? endThisMonth
    : clampDayEnd(d.getFullYear(), d.getMonth() + 1, closingDay);

  // periodStart = giorno dopo la chiusura precedente
  const prevEnd = clampDayStart(periodEnd.getFullYear(), periodEnd.getMonth() - 1, closingDay);
  const periodStart = new Date(prevEnd);
  periodStart.setDate(prevEnd.getDate() + 1);
  periodStart.setHours(0, 0, 0, 0);

  return { periodStart, periodEnd };
}

// Finestra del ciclo "corrente" (quello che contiene oggi/`now`).
export function currentCycleWindow(closingDay: number, now: Date = new Date()): CycleWindow {
  return cycleWindowFor(now, closingDay);
}

// Debito di un ciclo = Σexpense − Σincome sulle transazioni della CC nella finestra.
// Positivo = debito (uscite > entrate). Le entrate sono rimborsi/storni sulla carta.
export async function computeCycleDebt(
  accountId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<number> {
  const totals = await prisma.transaction.groupBy({
    by: ['type'],
    where: { accountId, date: { gte: periodStart, lte: periodEnd } },
    _sum: { amount: true },
  });

  let income = 0;
  let expense = 0;
  for (const row of totals) {
    if (row.type === 'INCOME') income = Number(row._sum.amount ?? 0);
    if (row.type === 'EXPENSE') expense = Number(row._sum.amount ?? 0);
  }
  return expense - income;
}

// Garantisce l'esistenza del ciclo OPEN corrente per una CC e lo ritorna.
// Idempotente grazie allo unique [accountId, periodStart].
export async function ensureOpenCycle(
  userId: string,
  account: { id: string; closingDay: number | null; billingDay: number | null },
  now: Date = new Date(),
) {
  const closingDay = effectiveClosingDay(account);
  const { periodStart, periodEnd } = currentCycleWindow(closingDay, now);

  const existing = await prisma.billingCycle.findUnique({
    where: { accountId_periodStart: { accountId: account.id, periodStart } },
  });
  if (existing) return existing;

  return prisma.billingCycle.create({
    data: {
      userId,
      accountId: account.id,
      periodStart,
      periodEnd,
      status: 'OPEN',
    },
  });
}

// Debito del ciclo OPEN corrente di una CC (positivo = debito).
export async function openCycleDebt(
  account: { id: string; closingDay: number | null; billingDay: number | null },
  now: Date = new Date(),
): Promise<number> {
  const closingDay = effectiveClosingDay(account);
  const { periodStart, periodEnd } = currentCycleWindow(closingDay, now);
  return computeCycleDebt(account.id, periodStart, periodEnd);
}

// Etichetta leggibile del ciclo (mese/anno del giorno di chiusura).
export function cycleLabel(periodEnd: Date): string {
  return periodEnd.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
}

// Allinea la PlannedTransaction (pagamento) collegata a un ciclo CHIUSO al debito
// ricalcolato. Crea la pianificata se manca, la aggiorna se l'importo è cambiato,
// la elimina se il debito è sceso a ≤ 0. Non tocca pianificate già pagate (quel
// caso è gestito a monte con un conguaglio). Ritorna il debtAmount aggiornato.
export async function syncCyclePlanned(
  cycle: {
    id: string;
    userId: string;
    accountId: string;
    periodEnd: Date;
    billingDate: Date | null;
    plannedTransactionId: string | null;
  },
  account: { id: string; name: string; linkedAccountId: string | null; billingDay: number | null },
  debt: number,
): Promise<number> {
  const rounded = Math.round(debt * 100) / 100;

  // Pianificata già collegata
  if (cycle.plannedTransactionId) {
    const planned = await prisma.plannedTransaction.findUnique({
      where: { id: cycle.plannedTransactionId },
    });

    if (planned && planned.isPaid) {
      // Ciclo già pagato: non si tocca qui (gestito con conguaglio dal chiamante).
      return Number(planned.amount);
    }

    if (rounded <= 0) {
      // Debito azzerato: rimuovi pianificata e scollega
      if (planned) await prisma.plannedTransaction.delete({ where: { id: planned.id } });
      await prisma.billingCycle.update({
        where: { id: cycle.id },
        data: { plannedTransactionId: null, debtAmount: 0 },
      });
      return 0;
    }

    if (planned) {
      await prisma.plannedTransaction.update({
        where: { id: planned.id },
        data: { amount: rounded },
      });
      await prisma.billingCycle.update({ where: { id: cycle.id }, data: { debtAmount: rounded } });
      return rounded;
    }
  }

  // Nessuna pianificata: creala se c'è debito
  if (rounded <= 0) {
    await prisma.billingCycle.update({ where: { id: cycle.id }, data: { debtAmount: 0 } });
    return 0;
  }

  const billingDate =
    cycle.billingDate ?? nextBillingDate(account.billingDay ?? 15, cycle.periodEnd);

  // Categoria di sistema "Pagamento Carta": rende l'addebito sempre tracciabile e
  // permette di escluderlo in modo affidabile dalle medie/proposte di budget.
  const settlementCategoryId = await ensureSettlementCategory(cycle.userId);

  const planned = await prisma.plannedTransaction.create({
    data: {
      userId: cycle.userId,
      type: 'EXPENSE',
      amount: rounded,
      description: `Addebito ${account.name} - ${cycleLabel(cycle.periodEnd)}`,
      plannedDate: billingDate,
      accountId: account.linkedAccountId,
      ccAccountId: account.id,
      categoryId: settlementCategoryId,
    },
  });

  await prisma.billingCycle.update({
    where: { id: cycle.id },
    data: { plannedTransactionId: planned.id, debtAmount: rounded, billingDate },
  });

  return rounded;
}

// Contributo al debito: una spesa aumenta il debito, un'entrata (rimborso) lo riduce.
export function debtContribution(type: 'INCOME' | 'EXPENSE', amount: number): number {
  return type === 'EXPENSE' ? amount : -amount;
}

interface CcChange {
  accountId: string | null;
  date: Date;
  signed: number; // variazione di debito apportata da questa operazione
}

// Riconcilia le modifiche di transazione che toccano cicli CC.
//   • Ciclo OPEN (o inesistente): nessuna azione, il saldo si ri-deriva dalle txn.
//   • Ciclo CHIUSO non pagato: ricalcola il debito dalle transazioni e aggiorna
//     la pianificata collegata.
//   • Ciclo CHIUSO già pagato: crea un conguaglio nel ciclo OPEN corrente pari
//     alla variazione (EXPENSE se aumenta il debito, INCOME se lo riduce).
// Va chiamata DOPO aver scritto la transazione (così il ricalcolo è coerente).
// Ritorna true se almeno una pianificata è stata creata/modificata.
export async function reconcileCcChanges(
  userId: string,
  changes: CcChange[],
  now: Date = new Date(),
): Promise<boolean> {
  const ccChanges = changes.filter((c) => c.accountId);
  if (ccChanges.length === 0) return false;

  const accountIds = [...new Set(ccChanges.map((c) => c.accountId as string))];
  const accounts = await prisma.account.findMany({
    where: { id: { in: accountIds }, userId, type: 'CREDIT_CARD' },
    select: { id: true, name: true, closingDay: true, billingDay: true, linkedAccountId: true },
  });
  const accMap = new Map(accounts.map((a) => [a.id, a]));

  // Raggruppa le variazioni per (CC, ciclo) sommando i delta
  const groups = new Map<
    string,
    { account: (typeof accounts)[number]; window: CycleWindow; delta: number }
  >();
  for (const c of ccChanges) {
    const account = accMap.get(c.accountId as string);
    if (!account) continue; // non è una CC
    const window = cycleWindowFor(c.date, effectiveClosingDay(account));
    const key = `${account.id}|${window.periodStart.toISOString()}`;
    const existing = groups.get(key);
    if (existing) existing.delta += c.signed;
    else groups.set(key, { account, window, delta: c.signed });
  }

  let plannedChanged = false;

  for (const { account, window, delta } of groups.values()) {
    const cycle = await prisma.billingCycle.findUnique({
      where: { accountId_periodStart: { accountId: account.id, periodStart: window.periodStart } },
    });
    if (!cycle || cycle.status === 'OPEN') continue; // ciclo aperto: nulla da fare

    const planned = cycle.plannedTransactionId
      ? await prisma.plannedTransaction.findUnique({ where: { id: cycle.plannedTransactionId } })
      : null;

    if (planned && planned.isPaid) {
      // Ciclo già pagato → conguaglio nel ciclo OPEN corrente. Stessa categoria di
      // sistema degli altri addebiti CC: sempre tracciabile e fuori dalle medie budget.
      if (Math.abs(delta) >= 0.005) {
        await prisma.transaction.create({
          data: {
            userId,
            accountId: account.id,
            amount: Math.abs(Math.round(delta * 100) / 100),
            type: delta > 0 ? 'EXPENSE' : 'INCOME',
            description: `Conguaglio ${account.name} - ${cycleLabel(window.periodEnd)}`,
            date: now,
            categoryId: await ensureSettlementCategory(userId),
          },
        });
      }
    } else {
      // Ciclo chiuso non pagato → ricalcola e aggiorna la pianificata
      const debt = await computeCycleDebt(account.id, window.periodStart, window.periodEnd);
      await syncCyclePlanned(cycle, account, debt);
      plannedChanged = true;
    }
  }

  return plannedChanged;
}
