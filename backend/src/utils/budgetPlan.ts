import prisma from './prisma';
import { getAccountsWithBalances, getLiquidBalance } from './balance';
import { collectProjectionEvents } from './projection';
import { loadPayPeriod, loadPayBoundaries, addDays, startOfDay, daysBetween } from './payPeriod';
import { loadClassifiedExpenses, loadSpendingRhythm, isoDay } from './spendingRhythm';
import { budgetWindowFor, recentBudgetWindows, budgetWindowLabel, type BudgetWindow } from './budgetPeriod';

// ── Piano del budget (proposte intelligenti) ─────────────────────────────────
//
//   Quanto si può spendere in un periodo (di paga o mese) e quali tetti proporre
//   per categoria, con la STESSA logica di Proiezione e Analisi:
//
//   • Tutto "per competenza": una spesa conta alla data d'acquisto, anche su carta.
//     Per questo il punto di partenza è la DISPONIBILITÀ NETTA = liquidità − debito
//     carte (ciclo aperto + addebiti non ancora pagati): gli acquisti già fatti con
//     carta sono soldi già impegnati. Gli addebiti dei cicli non sono spese nuove.
//   • Periodo in corso = piano dell'INTERO periodo:
//       disponibile = netto a inizio periodo + entrate del periodo − impegni del periodo
//     dove entrate/impegni = già avvenuti (transazioni) + ancora attesi (ricorrenti non
//     eseguite, pianificate non pagate). Il netto a inizio periodo si ricostruisce da
//     quello di oggi. Così lo "spendibile" è confrontabile con lo speso dei budget,
//     che parte anch'esso dall'inizio del periodo.
//   • Periodo successivo: il netto a inizio periodo è quello di oggi + flussi noti
//     fino all'inizio + spesa variabile stimata col ritmo quotidiano.
//   • Risparmio = quota delle ENTRATE del periodo (come descrive l'impostazione),
//     mai oltre il disponibile.
//   • Tetti per categoria = media della spesa VARIABILE degli ultimi periodi con dati
//     (fisse e rate sono già negli impegni: niente tetti su di esse), meno un taglio.

export const SUGG_HIST_PERIODS = 3;
export const STANDARD_CUT = 0.15;

const round2 = (n: number): number => Math.round(n * 100) / 100;

export interface PlanFlows {
  income: number;
  fixed: number;     // spese fisse + programmate (competenza)
  variable: number;  // solo per il già avvenuto / stimato
}

// Funzione PURA: disponibile del periodo.
//   actual: già avvenuto nel periodo (solo periodo in corso);
//   expected: ancora atteso nel periodo;
//   gap: flussi tra oggi e l'inizio del periodo (solo periodo successivo).
export function planWindow(input: {
  netNow: number;
  actual: PlanFlows | null;
  expected: { income: number; fixed: number };
  gap: PlanFlows | null;
}) {
  const { netNow, actual, expected, gap } = input;
  // Netto a inizio periodo.
  const netStart = actual
    ? netNow - actual.income + actual.fixed + actual.variable
    : netNow + (gap ? gap.income - gap.fixed - gap.variable : 0);
  const income = (actual?.income ?? 0) + expected.income;
  const fixed = (actual?.fixed ?? 0) + expected.fixed;
  return { netStart: round2(netStart), income: round2(income), fixed: round2(fixed), disposable: round2(netStart + income - fixed) };
}

// Risparmio e spendibile (PURA): quota delle entrate, mai oltre il disponibile.
export function applySaving(disposable: number, income: number, rate: number) {
  const savingTarget = round2(Math.min(Math.max(0, disposable), Math.max(0, income) * rate));
  return { savingTarget, spendable: round2(disposable - savingTarget) };
}

export interface CategorySuggestion {
  categoryId: string;
  name: string;
  icon: string | null;
  color: string | null;
  avgPerPeriod: number;
  suggestedCap: number;
  currentBudgetId: string | null;
  currentAmount: number | null;
  currentPeriod: string | null;
}

export interface BudgetPlan {
  mode: 'pay' | 'month';
  payPeriodConfigured: boolean;
  budgetPeriod: 'PAY_PERIOD' | 'MONTHLY';
  offset: 0 | 1;
  window: { start: string; end: string; label: string; days: number; elapsedDays: number };
  liquidity: number;
  ccDebt: number;
  netNow: number;
  netStart: number;
  expectedIncome: number;     // entrate dell'intero periodo
  fixedCommitments: number;   // fisse + programmate dell'intero periodo
  disposable: number;
  variableSpent: number;      // spesa variabile già fatta nel periodo (in corso)
  actual: PlanFlows | null;
  gap: PlanFlows | null;
  perCategory: CategorySuggestion[];
}

export async function computeBudgetPlan(
  userId: string,
  opts: { mode: 'pay' | 'month'; offset: 0 | 1; accountIds?: string[] },
  now: Date = new Date(),
): Promise<BudgetPlan> {
  const today = startOfDay(now);
  const payInfo = await loadPayPeriod(userId, now, SUGG_HIST_PERIODS);
  const usePay = opts.mode === 'pay' && payInfo.configured;
  const budgetPeriod = usePay ? 'PAY_PERIOD' : 'MONTHLY';

  // Stesse finestre dei budget: con PAY_PERIOD dai confini del periodo di paga.
  const histFrom = new Date(today.getFullYear(), today.getMonth() - (SUGG_HIST_PERIODS + 3), 1);
  const boundaries = usePay ? await loadPayBoundaries(userId, histFrom, addDays(today, 80), now) : null;
  const current = budgetWindowFor(now, budgetPeriod, boundaries);
  const next = budgetWindowFor(addDays(current.periodEnd, 1), budgetPeriod, boundaries);
  const win: BudgetWindow = opts.offset === 1 ? next : current;

  // ── Perimetro dei conti ──
  const accounts = await getAccountsWithBalances(userId);
  const filtering = Array.isArray(opts.accountIds) && opts.accountIds.length > 0;
  const bankIds = new Set(
    accounts.filter((a) => a.type === 'BANK' && (!filtering || opts.accountIds!.includes(a.id))).map((a) => a.id),
  );
  const cardIds = new Set(
    accounts
      .filter((a) => a.type === 'CREDIT_CARD' && (!filtering || (a.linkedAccountId && bankIds.has(a.linkedAccountId))))
      .map((a) => a.id),
  );
  const scopeIds = accounts.length === 0 ? null : [...bankIds, ...cardIds];
  const inScope = (id: string | null | undefined) => (scopeIds === null ? true : !!id && (bankIds.has(id) || cardIds.has(id)));

  // ── Disponibilità netta di oggi ──
  const liquidity = filtering
    ? accounts.filter((a) => bankIds.has(a.id)).reduce((s, a) => s + a.balance, 0)
    : await getLiquidBalance(userId, accounts);
  const pendingCharges = cardIds.size === 0 ? [] : await prisma.plannedTransaction.findMany({
    where: { userId, isPaid: false, ccAccountId: { in: [...cardIds] } },
    select: { amount: true },
  });
  const ccDebt = accounts
    .filter((a) => cardIds.has(a.id) && !a.archived && a.balance < 0)
    .reduce((s, a) => s - a.balance, 0)
    + pendingCharges.reduce((s, p) => s + Number(p.amount), 0);
  const netNow = liquidity - ccDebt;

  // Flussi noti (per competenza) in un intervallo: ricorrenti non eseguite e
  // pianificate non pagate; le spese su carta contano come acquisti, gli addebiti
  // dei cicli no. Sospesi esclusi (senza data).
  const knownFlows = async (from: Date, to: Date) => {
    const end = new Date(to);
    end.setHours(23, 59, 59, 999);
    if (end < from) return { income: 0, fixed: 0 };
    const c = await collectProjectionEvents({ userId, accounts, scopeId: null, rangeStart: from, rangeEnd: end, withSuspended: false, now });
    let income = 0;
    let fixed = 0;
    for (const e of c.events) {
      if (e.source !== 'recurring' && e.source !== 'planned') continue;
      if (e.settlement || !inScope(e.accountId)) continue;
      if (e.type === 'INCOME') income += e.amount;
      else fixed += e.amount;
    }
    for (const e of c.ccEvents) {
      if (!inScope(e.cardId)) continue;
      if (e.signed > 0) fixed += e.signed;
      else income += -e.signed;
    }
    return { income, fixed };
  };

  const expected = await knownFlows(win.periodStart, win.periodEnd);

  let actual: PlanFlows | null = null;
  let gap: PlanFlows | null = null;
  if (opts.offset === 0) {
    const [lines, incomeTx] = await Promise.all([
      loadClassifiedExpenses(userId, win.periodStart, now, scopeIds),
      prisma.transaction.findMany({
        where: {
          userId, type: 'INCOME', transferId: null, date: { gte: win.periodStart, lte: now },
          ...(scopeIds ? { accountId: { in: scopeIds } } : {}),
          OR: [{ categoryId: null }, { category: { isSystem: false } }],
        },
        select: { amount: true },
      }),
    ]);
    actual = {
      income: incomeTx.reduce((s, t) => s + Number(t.amount), 0),
      fixed: lines.filter((l) => l.kind !== 'variable').reduce((s, l) => s + l.amount, 0),
      variable: lines.filter((l) => l.kind === 'variable').reduce((s, l) => s + l.amount, 0),
    };
  } else {
    // Da oggi alla vigilia del periodo successivo: flussi noti ancora attesi nel
    // periodo in corso + spesa variabile stimata col ritmo quotidiano del perimetro.
    const gapKnown = await knownFlows(current.periodStart, addDays(win.periodStart, -1));
    const rhythm = await loadSpendingRhythm(userId, payInfo, scopeIds, now);
    const daysLeft = Math.max(0, daysBetween(today, win.periodStart));
    gap = { income: gapKnown.income, fixed: gapKnown.fixed, variable: rhythm.dailyRate * daysLeft };
  }

  const plan = planWindow({ netNow, actual, expected, gap });

  // ── Tetti per categoria dalla spesa variabile dei periodi precedenti ──
  const histWindows = recentBudgetWindows(budgetPeriod, SUGG_HIST_PERIODS + 1, now, boundaries)
    .filter((w) => w.periodEnd < current.periodStart);
  const perCategory = await suggestCaps(userId, histWindows);

  return {
    mode: usePay ? 'pay' : 'month',
    payPeriodConfigured: payInfo.configured,
    budgetPeriod,
    offset: opts.offset,
    window: {
      start: isoDay(win.periodStart),
      end: isoDay(win.periodEnd),
      label: budgetWindowLabel(win, budgetPeriod),
      days: daysBetween(win.periodStart, win.periodEnd) + 1,
      elapsedDays: opts.offset === 0 ? Math.min(daysBetween(win.periodStart, today) + 1, daysBetween(win.periodStart, win.periodEnd) + 1) : 0,
    },
    liquidity: round2(liquidity),
    ccDebt: round2(ccDebt),
    netNow: round2(netNow),
    netStart: plan.netStart,
    expectedIncome: plan.income,
    fixedCommitments: plan.fixed,
    disposable: plan.disposable,
    variableSpent: round2(actual?.variable ?? 0),
    actual: actual && { income: round2(actual.income), fixed: round2(actual.fixed), variable: round2(actual.variable) },
    gap: gap && { income: round2(gap.income), fixed: round2(gap.fixed), variable: round2(gap.variable) },
    perCategory,
  };
}

// Media della spesa variabile per categoria sui periodi CON dati (un periodo senza
// movimenti, o iniziato prima dei primi dati, non abbassa la media). Tutti i conti, come lo speso
// dei budget.
async function suggestCaps(userId: string, windows: BudgetWindow[]): Promise<CategorySuggestion[]> {
  if (windows.length === 0) return [];
  const from = windows[0].periodStart;
  const to = windows[windows.length - 1].periodEnd;
  const now = new Date();
  const [lines, activity, firstTxn, activeBudgets] = await Promise.all([
    loadClassifiedExpenses(userId, from, to, null),
    prisma.transaction.findMany({ where: { userId, date: { gte: from, lte: to } }, select: { date: true } }),
    prisma.transaction.findFirst({ where: { userId }, orderBy: { date: 'asc' }, select: { date: true } }),
    prisma.budget.findMany({
      where: {
        userId, categoryId: { not: null }, startDate: { lte: now },
        OR: [{ endDate: null }, { endDate: { gte: now } }],
      },
      select: { id: true, categoryId: true, amount: true, period: true },
    }),
  ]);
  // Periodi usabili: iniziati dopo il primo movimento registrato (un periodo in cui
  // l'app era usata solo in parte abbasserebbe la media) e con almeno un movimento.
  const dataStart = firstTxn ? startOfDay(firstTxn.date) : null;
  const withData = windows.filter((w) =>
    !!dataStart && w.periodStart >= dataStart && activity.some((t) => t.date >= w.periodStart && t.date <= w.periodEnd));
  if (withData.length === 0) return [];
  const inData = (d: Date) => withData.some((w) => d >= w.periodStart && d <= w.periodEnd);

  type Acc = { name: string; icon: string | null; color: string | null; total: number };
  const byCat = new Map<string, Acc>();
  for (const l of lines) {
    if (l.kind !== 'variable' || !l.categoryId || !inData(l.date)) continue;
    const e = byCat.get(l.categoryId) ?? { name: l.categoryName, icon: l.icon, color: l.color, total: 0 };
    e.total += l.amount;
    byCat.set(l.categoryId, e);
  }
  const budgetByCat = new Map(activeBudgets.map((b) => [b.categoryId!, b]));

  const out: CategorySuggestion[] = [];
  byCat.forEach((e, categoryId) => {
    const avg = e.total / withData.length;
    if (avg < 0.01) return;
    const existing = budgetByCat.get(categoryId) ?? null;
    out.push({
      categoryId,
      name: e.name,
      icon: e.icon,
      color: e.color,
      avgPerPeriod: round2(avg),
      suggestedCap: round2(avg * (1 - STANDARD_CUT)),
      currentBudgetId: existing?.id ?? null,
      currentAmount: existing ? Number(existing.amount) : null,
      currentPeriod: existing?.period ?? null,
    });
  });
  return out.sort((a, b) => b.avgPerPeriod - a.avgPerPeriod);
}
