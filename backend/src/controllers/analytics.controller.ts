import { Response } from 'express';
import prisma from '../utils/prisma';
import { AuthRequest } from '../types';
import { analyticsCache } from '../utils/analyticsCache';
import { getAccountsWithBalances, getLiquidBalance, type AccountBalance } from '../utils/balance';
import { loadPayPeriod, serializePayPeriod, addDays, startOfDay, daysBetween, calendarPeriods, payPeriodsForAnalysis } from '../utils/payPeriod';
import { loadSpendingRhythm, loadClassifiedExpenses, isoDay, type SpendingRhythm } from '../utils/spendingRhythm';
import { buildProjectedPoints, buildRhythmEvents, collectProjectionEvents } from '../utils/projection';

// ── Stima fino al prossimo stipendio ─────────────────────────────────────────
//
//   Risponde a "quanto mi resta, e come ci arrivo, fino al prossimo accredito?".
//   Orizzonte: da oggi al giorno PRIMA dello stipendio (periodo di paga, non mese
//   solare). Stessi eventi della proiezione (collectProjectionEvents: ricorrenti,
//   pianificate, rate, addebiti carta) + il ritmo quotidiano stimato dagli ultimi
//   periodi di paga (spesa variabile, vedi spendingRhythm).
//
//   In più, per ogni conto BANK il punto più basso previsto: senza fido conta il
//   timing del singolo conto, non solo la liquidità aggregata.

const round2 = (n: number): number => Math.round(n * 100) / 100;

type Point = { date: string; balance: number };

const lowestOf = (points: Point[]): { value: number; date: string } | null => {
  if (points.length === 0) return null;
  let min = points[0];
  for (const p of points) if (p.balance < min.balance) min = p;
  return { value: round2(min.balance), date: min.date };
};

// Proietta uno scope (null = tutta la liquidità, altrimenti un conto BANK + le sue
// carte collegate) sul range, con e senza ritmo quotidiano.
async function projectScope(params: {
  userId: string;
  accounts: AccountBalance[];
  scopeId: string | null;
  startBalance: number;
  rangeStart: Date;
  rangeEnd: Date;
  rhythm: SpendingRhythm;
  now: Date;
}) {
  const { userId, accounts, scopeId, startBalance, rangeStart, rangeEnd, rhythm, now } = params;
  const c = await collectProjectionEvents({ userId, accounts, scopeId, rangeStart, rangeEnd, withSuspended: false, now });
  const rhythmEvents = (rate: number) => buildRhythmEvents({
    rate, shareByAccount: rhythm.shareByAccount, accounts, scopeId,
    rangeStart, rangeEnd, ccEvents: c.ccEvents, ccAccountsForCharge: c.ccAccountsForCharge, now,
  });
  const series = (extra: ReturnType<typeof rhythmEvents>) =>
    buildProjectedPoints(startBalance, [...c.events, ...extra], rangeStart, rangeEnd);

  const central = rhythmEvents(rhythm.dailyRate);
  return {
    collected: c,
    standard: series([]),
    withRhythm: series(central),
    rhythmTotal: central.reduce((s, e) => s + e.amount, 0),
    // Ritmo alto → saldo più basso.
    low: rhythm.high > rhythm.low ? series(rhythmEvents(rhythm.high)) : null,
    high: rhythm.high > rhythm.low ? series(rhythmEvents(rhythm.low)) : null,
  };
}

export const getForecast = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

    const cacheKey = analyticsCache.keys.forecast(userId);
    const cached = analyticsCache.get<object>(cacheKey);
    if (cached) return res.json(cached);

    const now = new Date();
    const today = startOfDay(now);
    const payPeriod = await loadPayPeriod(userId, now);
    const accounts = await getAccountsWithBalances(userId);
    const currentBalance = await getLiquidBalance(userId, accounts);
    const rhythm = await loadSpendingRhythm(userId, payPeriod, accounts.length > 0 ? accounts.map((a) => a.id) : null, now);

    // Orizzonte: oggi → vigilia dell'accredito (fine giornata).
    const eve = addDays(payPeriod.nextPayday, -1);
    const daysRemaining = Math.max(0, daysBetween(today, eve));
    const rangeStart = today;
    const rangeEnd = new Date(Math.max(eve.getTime(), today.getTime()));
    rangeEnd.setHours(23, 59, 59, 999);

    const global = await projectScope({
      userId, accounts, scopeId: null, startBalance: currentBalance,
      rangeStart, rangeEnd, rhythm, now,
    });

    const knownIncome = global.collected.projectedIncome;
    const knownExpenses = global.collected.projectedExpense;
    const hasFuture = daysRemaining > 0;
    // Stima alla vigilia come waterfall esplicito (coerente con le righe mostrate).
    // Senza giorni futuri (stipendio domani/oggi) resta il saldo attuale.
    const standardAtEve = hasFuture ? currentBalance + knownIncome - knownExpenses : currentBalance;
    const rhythmAtEve = hasFuture ? standardAtEve - global.rhythmTotal : currentBalance;
    const lastOf = (pts: Point[] | null) => (pts && pts.length > 0 ? pts[pts.length - 1].balance : null);

    // Quanto si può spendere al giorno (oltre agli impegni) senza che la liquidità
    // scenda mai sotto zero prima dello stipendio: min sui giorni futuri di
    // saldo_standard(d) / giorni trascorsi da oggi a d.
    let spendablePerDay: number | null = null;
    if (hasFuture) {
      let s = Infinity;
      global.standard.forEach((p, i) => {
        if (i === 0) return; // oggi = saldo attuale, nessun giorno di spesa
        s = Math.min(s, p.balance / i);
      });
      spendablePerDay = Number.isFinite(s) ? round2(Math.max(0, s)) : null;
    }

    // Punto più basso per conto BANK (solo con più conti: con uno solo coincide
    // con il dato aggregato).
    const bankAccounts = accounts.filter((a) => a.type === 'BANK' && !a.archived);
    let accountLows: object[] = [];
    if (bankAccounts.length > 1 && hasFuture) {
      const meta = await prisma.account.findMany({
        where: { id: { in: bankAccounts.map((a) => a.id) } },
        select: { id: true, name: true, color: true },
      });
      const metaById = new Map(meta.map((m) => [m.id, m]));
      accountLows = await Promise.all(bankAccounts.map(async (a) => {
        const scoped = await projectScope({
          userId, accounts, scopeId: a.id, startBalance: a.balance,
          rangeStart, rangeEnd, rhythm, now,
        });
        const std = lowestOf(scoped.standard);
        const withR = lowestOf(scoped.withRhythm);
        return {
          id: a.id,
          name: metaById.get(a.id)?.name ?? 'Conto',
          color: metaById.get(a.id)?.color ?? null,
          balance: round2(a.balance),
          standardMin: std,
          rhythmMin: withR,
        };
      }));
    }

    const result = {
      payPeriod: serializePayPeriod(payPeriod, now),
      eveDate: isoDay(eve < today ? today : eve),
      daysRemaining,
      currentBalance: round2(currentBalance),
      known: { income: round2(hasFuture ? knownIncome : 0), expenses: round2(hasFuture ? knownExpenses : 0) },
      rhythm: {
        basis: rhythm.basis,
        dailyRate: rhythm.dailyRate,
        low: rhythm.low,
        high: rhythm.high,
        periods: rhythm.periods,
        current: rhythm.current,
        topCategories: rhythm.topCategories,
        remaining: round2(hasFuture ? global.rhythmTotal : 0),
      },
      atEve: {
        standard: round2(standardAtEve),
        withRhythm: round2(rhythmAtEve),
        // Fascia: con il ritmo più alto/basso dei periodi di confronto.
        low: hasFuture && global.low ? round2(lastOf(global.low)!) : round2(rhythmAtEve),
        high: hasFuture && global.high ? round2(lastOf(global.high)!) : round2(rhythmAtEve),
      },
      lowest: {
        standard: lowestOf(global.standard),
        withRhythm: lowestOf(global.withRhythm),
      },
      spendablePerDay,
      accounts: accountLows,
    };

    analyticsCache.set(cacheKey, result);
    res.json(result);
  } catch (error) {
    console.error('Get forecast error:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
};

// Periodo di paga corrente (anteprima in Impostazioni e orizzonte "Stipendio").
export const getPayPeriod = async (req: AuthRequest, res: Response) => {
  try {
    const now = new Date();
    const payPeriod = await loadPayPeriod(req.userId!, now);
    res.json(serializePayPeriod(payPeriod, now));
  } catch (error) {
    console.error('Get pay period error:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
};

// ── Analisi spese ────────────────────────────────────────────────────────────
//
//   Dati grezzi ma già normalizzati per la sezione Analisi: le righe di spesa
//   degli ultimi N periodi (di paga o mesi solari) alla data d'ACQUISTO, carte
//   incluse, classificate fisse/programmate/variabili; le entrate per periodo; e,
//   per il periodo in corso, gli impegni ancora attesi fino alla sua fine. Le
//   aggregazioni (categorie, abitudini, confronti) si fanno lato client: così il
//   drill-down non richiede altre chiamate.
//   Param: ?periods=3..12 (default 6), ?mode=pay|month (default pay).

export const getSpendingAnalysis = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const count = Math.min(Math.max(parseInt((req.query.periods as string) || '6', 10) || 6, 3), 12);
    const mode = req.query.mode === 'month' ? 'month' : 'pay';

    const cacheKey = analyticsCache.keys.spending(userId, `${mode}:${count}`);
    const cached = analyticsCache.get<object>(cacheKey);
    if (cached) return res.json(cached);

    const now = new Date();
    const payPeriod = await loadPayPeriod(userId, now, count - 1);
    const periods = mode === 'pay' && payPeriod.configured
      ? payPeriodsForAnalysis(payPeriod)
      : calendarPeriods(now, count);
    const effectiveMode = mode === 'pay' && payPeriod.configured ? 'pay' : 'month';

    const accounts = await getAccountsWithBalances(userId);
    const accountIds = accounts.length > 0 ? accounts.map((a) => a.id) : null;
    const from = periods[0].start;

    const [lines, incomeTx, categories, accountMeta] = await Promise.all([
      loadClassifiedExpenses(userId, from, now, accountIds),
      prisma.transaction.findMany({
        where: {
          userId, type: 'INCOME', transferId: null, date: { gte: from, lte: now },
          ...(accountIds ? { accountId: { in: accountIds } } : {}),
          OR: [{ categoryId: null }, { category: { isSystem: false } }],
        },
        select: { date: true, amount: true },
      }),
      prisma.category.findMany({
        where: { userId },
        select: { id: true, name: true, color: true, icon: true, type: true },
      }),
      prisma.account.findMany({
        where: { userId },
        select: { id: true, name: true, color: true, type: true, archivedAt: true },
      }),
    ]);

    const income = periods.map((p) => round2(
      incomeTx.filter((t) => t.date >= p.start && t.date < p.end).reduce((s, t) => s + Number(t.amount), 0),
    ));

    // Periodo in corso: impegni attesi da domani alla fine del periodo, alla data
    // d'acquisto (spese su carta incluse come acquisti, non come addebito).
    const current = periods[periods.length - 1];
    const today = startOfDay(now);
    const lastDay = addDays(current.end, -1);
    let knownRemaining = 0;
    if (lastDay > today) {
      const rangeEnd = new Date(lastDay);
      rangeEnd.setHours(23, 59, 59, 999);
      const c = await collectProjectionEvents({
        userId, accounts, scopeId: null, rangeStart: addDays(today, 1), rangeEnd, withSuspended: false, now,
      });
      knownRemaining = c.events
        .filter((e) => e.type === 'EXPENSE' && (e.source === 'recurring' || e.source === 'planned'))
        .reduce((s, e) => s + e.amount, 0)
        + c.ccEvents.filter((e) => e.signed > 0).reduce((s, e) => s + e.signed, 0);
    }

    const result = {
      mode: effectiveMode,
      payPeriodConfigured: payPeriod.configured,
      today: isoDay(today),
      periods: periods.map((p) => ({
        start: isoDay(p.start),
        end: isoDay(p.end),
        days: daysBetween(p.start, p.end),
        elapsedDays: p.isCurrent ? Math.min(daysBetween(p.start, today) + 1, daysBetween(p.start, p.end)) : daysBetween(p.start, p.end),
        isCurrent: p.isCurrent,
      })),
      income,
      knownRemaining: round2(knownRemaining),
      lines: lines.map((l) => ({
        date: isoDay(l.date),
        amount: round2(l.amount),
        categoryId: l.categoryId,
        kind: l.kind,
        accountId: l.accountId,
        description: l.description,
        txId: l.txId,
      })),
      categories: categories.filter((c) => c.type === 'EXPENSE').map(({ type: _t, ...c }) => c),
      accounts: accountMeta.map((a) => ({ id: a.id, name: a.name, color: a.color, type: a.type, archived: a.archivedAt !== null })),
    };

    analyticsCache.set(cacheKey, result);
    res.json(result);
  } catch (error) {
    console.error('Get spending analysis error:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
};

// ── Patrimonio netto oggi ────────────────────────────────────────────────────
//
//   La liquidità (Σ conti BANK) non basta a dire quanto si possiede: qui si
//   aggiungono i crediti ancora da incassare e si tolgono i debiti ancora da
//   pagare. Non cacheato (poche query, dipende da molte mutation).
//     • Debito carte: ciclo aperto + addebiti di cicli chiusi non ancora pagati.
//     • Piani a rate: rate non pagate, per direzione (DEBT / CREDIT).
//     • Sospesi: importi noti senza data (uscite = debiti, entrate = crediti).

export const getNetWorthNow = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const accounts = await getAccountsWithBalances(userId);
    const liquidity = await getLiquidBalance(userId, accounts);

    const [pendingCharges, planRates, suspended] = await Promise.all([
      prisma.plannedTransaction.findMany({
        where: { userId, isPaid: false, ccAccountId: { not: null } },
        select: { amount: true },
      }),
      prisma.plannedTransaction.findMany({
        where: { userId, isPaid: false, plan: { status: 'ACTIVE' } },
        select: { amount: true, plannedDate: true, plan: { select: { id: true, title: true, direction: true, status: true } } },
      }),
      prisma.plannedTransaction.findMany({
        where: { userId, isPaid: false, plannedDate: null, planId: null },
        select: { amount: true, type: true },
      }),
    ]);

    const ccOpen = accounts
      .filter((a) => a.type === 'CREDIT_CARD' && !a.archived && a.balance < 0)
      .reduce((s, a) => s - a.balance, 0);
    const ccDebt = ccOpen + pendingCharges.reduce((s, p) => s + Number(p.amount), 0);

    type PlanAgg = { id: string; title: string; remaining: number; count: number; nextDate: string | null };
    const byPlan = new Map<string, PlanAgg & { direction: string }>();
    for (const r of planRates) {
      if (!r.plan) continue;
      const e = byPlan.get(r.plan.id) ?? { id: r.plan.id, title: r.plan.title, direction: r.plan.direction, remaining: 0, count: 0, nextDate: null };
      e.remaining += Number(r.amount);
      e.count += 1;
      const d = r.plannedDate ? isoDay(r.plannedDate) : null;
      if (d && (!e.nextDate || d < e.nextDate)) e.nextDate = d;
      byPlan.set(r.plan.id, e);
    }
    const plans = Array.from(byPlan.values()).map((p) => ({ ...p, remaining: round2(p.remaining) }));
    const debtPlans = plans.filter((p) => p.direction === 'DEBT').sort((a, b) => b.remaining - a.remaining);
    const creditPlans = plans.filter((p) => p.direction === 'CREDIT').sort((a, b) => b.remaining - a.remaining);
    const debts = debtPlans.reduce((s, p) => s + p.remaining, 0);
    const credits = creditPlans.reduce((s, p) => s + p.remaining, 0);
    const suspendedOut = suspended.filter((s) => s.type === 'EXPENSE').reduce((s, p) => s + Number(p.amount), 0);
    const suspendedIn = suspended.filter((s) => s.type === 'INCOME').reduce((s, p) => s + Number(p.amount), 0);

    res.json({
      liquidity: round2(liquidity),
      credits: round2(credits),
      suspendedIn: round2(suspendedIn),
      ccDebt: round2(ccDebt),
      debts: round2(debts),
      suspendedOut: round2(suspendedOut),
      netWorth: round2(liquidity + credits + suspendedIn - ccDebt - debts - suspendedOut),
      debtPlans: debtPlans.map(({ direction: _d, ...p }) => p),
      creditPlans: creditPlans.map(({ direction: _d, ...p }) => p),
    });
  } catch (error) {
    console.error('Get net worth now error:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
};
