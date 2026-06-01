import prisma from './prisma';

// ── Fonte di verità unica per i saldi ──────────────────────────────────────────
//
//   Tutta la dashboard (hero, proiezione, previsione) deve partire dallo stesso
//   "saldo attuale". La regola è:
//
//     • Conti BANK  → liquidità reale:  openingBalance + Σincome − Σexpense
//     • Carte (CC)  → debito temporaneo: −openingBalance + Σincome − Σexpense
//                     (saldo negativo durante il ciclo, NON è liquidità)
//
//   La liquidità reale = somma dei soli conti BANK, ed è esattamente il valore
//   mostrato nell'hero della dashboard (netWorth) e nella pagina Conti.

export type AccountBalance = {
  id: string;
  type: 'BANK' | 'CREDIT_CARD';
  openingBalance: number;
  billingDay: number | null;
  linkedAccountId: string | null;
  balance: number;
};

// Saldi calcolati per ogni conto dell'utente (stessa logica di account.controller,
// centralizzata qui per riuso).
export async function getAccountsWithBalances(userId: string): Promise<AccountBalance[]> {
  const accounts = await prisma.account.findMany({
    where: { userId },
    select: { id: true, type: true, openingBalance: true, billingDay: true, linkedAccountId: true },
  });

  if (accounts.length === 0) return [];

  const accountIds = accounts.map((a) => a.id);
  const totals = await prisma.transaction.groupBy({
    by: ['accountId', 'type'],
    where: { accountId: { in: accountIds } },
    _sum: { amount: true },
  });

  const map: Record<string, { income: number; expense: number }> = {};
  for (const row of totals) {
    if (!row.accountId) continue;
    if (!map[row.accountId]) map[row.accountId] = { income: 0, expense: 0 };
    if (row.type === 'INCOME')  map[row.accountId].income  = Number(row._sum.amount ?? 0);
    if (row.type === 'EXPENSE') map[row.accountId].expense = Number(row._sum.amount ?? 0);
  }

  return accounts.map((a) => {
    const { income = 0, expense = 0 } = map[a.id] ?? {};
    const ob = Number(a.openingBalance);
    const balance = a.type === 'CREDIT_CARD' ? -ob + income - expense : ob + income - expense;
    return {
      id: a.id,
      type: a.type as 'BANK' | 'CREDIT_CARD',
      openingBalance: ob,
      billingDay: a.billingDay,
      linkedAccountId: a.linkedAccountId,
      balance,
    };
  });
}

// Liquidità reale = Σ conti BANK. Coincide con il netWorth dell'hero.
//
//   Fallback: se l'utente non ha ancora configurato alcun conto, le transazioni
//   non sono associate ad alcun account → si ricade sul saldo "all-time" classico
//   (Σincome − Σexpense su tutte le transazioni) per non mostrare 0.
export async function getLiquidBalance(
  userId: string,
  accounts?: AccountBalance[],
): Promise<number> {
  const accts = accounts ?? (await getAccountsWithBalances(userId));

  if (accts.length === 0) {
    const [inc, exp] = await Promise.all([
      prisma.transaction.aggregate({ where: { userId, type: 'INCOME'  }, _sum: { amount: true } }),
      prisma.transaction.aggregate({ where: { userId, type: 'EXPENSE' }, _sum: { amount: true } }),
    ]);
    return Number(inc._sum.amount || 0) - Number(exp._sum.amount || 0);
  }

  return accts
    .filter((a) => a.type !== 'CREDIT_CARD')
    .reduce((sum, a) => sum + a.balance, 0);
}

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

// Debiti dei cicli CC ancora aperti, proiettati come uscite future alla prossima
// data di addebito. Una volta che il ciclo viene chiuso (closeBillingCycle) il
// saldo CC torna a 0 e il debito diventa una pianificata: i due meccanismi sono
// mutuamente esclusivi, quindi non c'è doppio conteggio.
//
//   Conta solo le CC con saldo negativo la cui prossima data di addebito cade
//   in [rangeStart, rangeEnd].
export function openCCObligations(
  accounts: AccountBalance[],
  rangeStart: Date,
  rangeEnd: Date,
  now: Date = new Date(),
): { total: number; count: number } {
  let total = 0;
  let count = 0;

  for (const cc of accounts) {
    if (cc.type !== 'CREDIT_CARD' || cc.balance >= 0) continue;
    const debt = Math.abs(cc.balance);
    const billingDay = cc.billingDay ?? 1;
    const dueDate = nextBillingDate(billingDay, now);
    if (dueDate >= rangeStart && dueDate <= rangeEnd) {
      total += debt;
      count += 1;
    }
  }

  return { total, count };
}
