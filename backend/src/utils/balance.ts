import prisma from './prisma';
import { currentCycleWindow, cycleWindowFor, effectiveClosingDay, computeCycleDebt, nextBillingDate } from './billingCycle';

export { nextBillingDate };

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
  closingDay: number | null;
  linkedAccountId: string | null;
  balance: number;
};

// Saldi calcolati per ogni conto dell'utente (stessa logica di account.controller,
// centralizzata qui per riuso).
export async function getAccountsWithBalances(userId: string): Promise<AccountBalance[]> {
  const accounts = await prisma.account.findMany({
    where: { userId },
    select: { id: true, type: true, openingBalance: true, billingDay: true, closingDay: true, linkedAccountId: true },
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

  // Per le CC il saldo è il debito del solo ciclo OPEN corrente (finestra basata
  // su closingDay): i cicli chiusi sono già diventati pianificate, quindi non
  // vanno ricontati nel saldo carta. Una query windowed per CC (poche per utente).
  const ccDebt: Record<string, number> = {};
  await Promise.all(
    accounts
      .filter((a) => a.type === 'CREDIT_CARD')
      .map(async (a) => {
        const { periodStart, periodEnd } = currentCycleWindow(effectiveClosingDay(a));
        ccDebt[a.id] = await computeCycleDebt(a.id, periodStart, periodEnd);
      }),
  );

  return accounts.map((a) => {
    const ob = Number(a.openingBalance);
    let balance: number;
    if (a.type === 'CREDIT_CARD') {
      // debito del ciclo aperto (positivo) → saldo negativo; openingBalance =
      // eventuale debito iniziale residuo non ancora assegnato a un ciclo.
      balance = -ob - (ccDebt[a.id] ?? 0);
    } else {
      const { income = 0, expense = 0 } = map[a.id] ?? {};
      balance = ob + income - expense;
    }
    return {
      id: a.id,
      type: a.type as 'BANK' | 'CREDIT_CARD',
      openingBalance: ob,
      billingDay: a.billingDay,
      closingDay: a.closingDay,
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

// Debiti dei cicli CC ancora aperti, proiettati come uscite future alla prossima
// data di addebito. Una volta che il ciclo viene chiuso (closeBillingCycle) il
// saldo CC torna a 0 e il debito diventa una pianificata: i due meccanismi sono
// mutuamente esclusivi, quindi non c'è doppio conteggio.
//
//   Conta solo le CC con saldo negativo la cui prossima data di addebito cade
//   in [rangeStart, rangeEnd]. Usato dalle proposte di budget (budget.controller):
//   la proiezione/previsione usano invece projectCcCharges, che tiene conto anche
//   delle spese future su CC, non solo del debito già maturato.
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

// Una spesa futura addebitata su una carta di credito (ricorrente o pianificata).
//   signed > 0  → EXPENSE (aumenta il debito del ciclo)
//   signed < 0  → INCOME/rimborso (riduce il debito del ciclo). Se il netto del ciclo
//                 scende ≤ 0 il credito NON diventa liquidità bancaria: un rimborso su
//                 carta riduce il debito, non aggiunge soldi sul conto → nessun addebito.
export type CcEvent = { cardId: string; date: Date; signed: number };

// Proietta gli addebiti futuri delle carte di credito come uscite di liquidità.
//
//   A differenza di una spesa su conto BANK (che lascia il conto alla sua data),
//   una spesa su CC confluisce nel debito del CICLO di appartenenza ed esce come
//   UNICO addebito aggregato al billingDay di quel ciclo, sul conto collegato.
//
//   Questa funzione raggruppa:
//     • il debito GIÀ maturato del ciclo aperto (da cc.balance negativo), seminato
//       sulla finestra del ciclo corrente;
//     • le spese FUTURE su CC (ccEvents), assegnate al loro ciclo via cycleWindowFor;
//   e per ogni ciclo con debito netto > 0 emette un addebito al billingDay del ciclo
//   (stessa convenzione di syncCyclePlanned → la data proiettata coincide con quella
//   del settlement reale che verrà creato). Emette solo gli addebiti la cui data
//   cade in [rangeStart, rangeEnd]. Così non c'è doppio conteggio: il ciclo aperto e
//   le spese future confluiscono nell'addebito del loro ciclo, una volta sola.
export function projectCcCharges(
  accounts: AccountBalance[],
  ccEvents: CcEvent[],
  rangeStart: Date,
  rangeEnd: Date,
  now: Date = new Date(),
): { date: Date; amount: number; cardId: string }[] {
  const cards = accounts.filter((a) => a.type === 'CREDIT_CARD');
  if (cards.length === 0) return [];

  // bucket per (carta, ciclo) → { periodEnd, debito netto }
  const buckets = new Map<string, { cardId: string; billingDay: number; periodEnd: Date; debt: number }>();

  const bucketFor = (card: AccountBalance, periodStart: Date, periodEnd: Date) => {
    const key = `${card.id}|${periodStart.toISOString()}`;
    let b = buckets.get(key);
    if (!b) {
      b = { cardId: card.id, billingDay: card.billingDay ?? 15, periodEnd, debt: 0 };
      buckets.set(key, b);
    }
    return b;
  };

  // 1. Semina il ciclo aperto col debito già maturato (cc.balance < 0).
  for (const card of cards) {
    const closingDay = effectiveClosingDay(card);
    const { periodStart, periodEnd } = currentCycleWindow(closingDay, now);
    const seed = card.balance < 0 ? -card.balance : 0;
    if (seed > 0) bucketFor(card, periodStart, periodEnd).debt += seed;
  }

  // 2. Assegna ogni spesa futura su CC al ciclo della sua data.
  const cardById = new Map(cards.map((c) => [c.id, c]));
  for (const ev of ccEvents) {
    const card = cardById.get(ev.cardId);
    if (!card) continue;
    const { periodStart, periodEnd } = cycleWindowFor(ev.date, effectiveClosingDay(card));
    bucketFor(card, periodStart, periodEnd).debt += ev.signed;
  }

  // 3. Emetti un addebito per ciclo con debito netto > 0, se il billingDay è nel range.
  //    Default billingDay 15: stessa convenzione di syncCyclePlanned, così la data
  //    proiettata coincide con quella del settlement reale che verrà creato.
  //    Edge: se billingDay == closingDay, periodEnd (23:59:59) > mezzanotte del
  //    candidato → nextBillingDate avanza al mese dopo. È coerente con syncCyclePlanned
  //    (stesso calcolo), quindi proiezione e realtà non divergono.
  const charges: { date: Date; amount: number; cardId: string }[] = [];
  for (const b of buckets.values()) {
    if (b.debt <= 0) continue;
    const dueDate = nextBillingDate(b.billingDay, b.periodEnd);
    if (dueDate >= rangeStart && dueDate <= rangeEnd) {
      charges.push({ date: dueDate, amount: b.debt, cardId: b.cardId });
    }
  }

  return charges;
}
