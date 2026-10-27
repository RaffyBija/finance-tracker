import { BudgetPeriod, BudgetRollover, Prisma } from '@prisma/client';
import prisma from './prisma';
import { loadClassifiedExpenses, type ExpenseKind } from './spendingRhythm';
import { recentBudgetWindows, type BudgetWindow } from './budgetPeriod';

// ── Speso dei budget ─────────────────────────────────────────────────────────
//
//   Il budget è un tetto sulla SPESA VARIABILE: le uscite generate da ricorrenti,
//   pianificate e rate (kind ≠ 'variable') sono già negli impegni del piano e non
//   entrano nello speso (restano visibili come `fixedSpent`, informativo).
//   Fonte unica: loadClassifiedExpenses su tutti i conti (competenza, split espansi,
//   esclusi trasferimenti e "Pagamento Carta"). Le righe si caricano UNA volta per
//   richiesta sul range che copre tutte le finestre, poi si aggrega in memoria.

export interface BudgetLine {
  date: Date;
  amount: number;
  categoryId: string | null;
  kind: ExpenseKind;
}

export interface BudgetLike {
  categoryId: string | null;
  startDate: Date;
  endDate: Date | null;
}

// Tetto di costo: il carry accumula al più sugli ultimi N periodi precedenti.
export const MAX_ROLLOVER_PERIODS = 12;

// Confini giornata locali: startDate → inizio giornata, endDate → FINE giornata
// (il giorno finale è incluso). Le date del form arrivano a mezzanotte.
export const startOfLocalDay = (d: Date): Date => {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
};
export const endOfLocalDay = (d: Date): Date => {
  const r = new Date(d);
  r.setHours(23, 59, 59, 999);
  return r;
};

// Intersezione [finestra-periodo] ∩ [startDate, endDate] a risoluzione-giorno.
// null = finestra vuota (periodo prima dell'attivazione o dopo la scadenza).
export function activeRange(budget: BudgetLike, window: BudgetWindow): { gte: Date; lte: Date } | null {
  const start = startOfLocalDay(budget.startDate);
  const gte = window.periodStart > start ? window.periodStart : start;
  const end = budget.endDate ? endOfLocalDay(budget.endDate) : null;
  const lte = end && end < window.periodEnd ? end : window.periodEnd;
  return gte > lte ? null : { gte, lte };
}

// Categorie coperte da un budget (PURA): null = budget globale (tutto); macro →
// macro + figlie (anche archiviate: la gerarchia resta).
export function budgetCategorySet(
  categoryId: string | null,
  categories: Array<{ id: string; parentId: string | null }>,
): Set<string> | null {
  if (!categoryId) return null;
  return new Set([categoryId, ...categories.filter((c) => c.parentId === categoryId).map((c) => c.id)]);
}

// Speso variabile e fisso di un budget in una finestra (PURA).
export function sumBudgetSpent(
  lines: BudgetLine[],
  budget: BudgetLike,
  window: BudgetWindow,
  cats: Set<string> | null,
): { spent: number; fixedSpent: number } {
  const range = activeRange(budget, window);
  let spent = 0;
  let fixedSpent = 0;
  if (!range) return { spent, fixedSpent };
  for (const l of lines) {
    if (l.date < range.gte || l.date > range.lte) continue;
    if (cats && (!l.categoryId || !cats.has(l.categoryId))) continue;
    if (l.kind === 'variable') spent += l.amount;
    else fixedSpent += l.amount;
  }
  return { spent: round2(spent), fixedSpent: round2(fixedSpent) };
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

// Finestre PRECEDENTI a `current` che entrano nel riporto (PURA): al più
// MAX_ROLLOVER_PERIODS e solo quelle in cui il budget era attivo per l'INTERO
// periodo (una finestra di attivazione/scadenza parziale accrediterebbe un envelope
// intero per un budget esistito pochi giorni: avanzo/debito fantasma).
export function carryWindows(
  budget: BudgetLike & { rollover: BudgetRollover; period: BudgetPeriod },
  current: BudgetWindow,
  pay: Date[] | null,
): BudgetWindow[] {
  if (budget.rollover === 'NONE') return [];
  const activeStart = startOfLocalDay(budget.startDate).getTime();
  const activeEnd = budget.endDate ? endOfLocalDay(budget.endDate).getTime() : Infinity;
  // Ancorate a `current` (non a "ora"): il carry è corretto anche per una finestra
  // storica. `+1` perché la finestra corrente fa parte del set e viene scartata.
  return recentBudgetWindows(budget.period, MAX_ROLLOVER_PERIODS + 1, current.periodEnd, pay).filter(
    (w) =>
      w.periodEnd < current.periodStart &&
      w.periodStart.getTime() >= activeStart &&
      w.periodEnd.getTime() <= activeEnd,
  );
}

// Fold del carry in ordine cronologico (PURA). effective(k) = amount + carry(k);
//   SURPLUS → carry = max(0, remaining)  (lo sforamento non si riporta)
//   FULL    → carry = remaining          (avanzo e debito si riportano)
export function foldCarry(amount: number, rollover: BudgetRollover, spentPerWindow: number[]): number {
  if (rollover === 'NONE') return 0;
  let carry = 0;
  for (const spent of spentPerWindow) {
    const remaining = amount + carry - spent;
    carry = rollover === 'FULL' ? remaining : Math.max(0, remaining);
  }
  return carry;
}

// Contesto di calcolo per una richiesta: righe classificate sull'unione delle
// finestre + gerarchia categorie. Una sola lettura, poi tutto in memoria.
export async function loadBudgetSpendContext(userId: string, windows: BudgetWindow[]) {
  if (windows.length === 0) return { lines: [] as BudgetLine[], categories: [] as Array<{ id: string; parentId: string | null }> };
  const from = new Date(Math.min(...windows.map((w) => w.periodStart.getTime())));
  const to = new Date(Math.max(...windows.map((w) => w.periodEnd.getTime())));
  const [lines, categories] = await Promise.all([
    loadClassifiedExpenses(userId, from, to, null),
    prisma.category.findMany({ where: { userId }, select: { id: true, parentId: true } }),
  ]);
  return { lines: lines as BudgetLine[], categories };
}

export type BudgetSpendContext = Awaited<ReturnType<typeof loadBudgetSpendContext>>;

// Carry entrante in `current` dal contesto già caricato.
export function carryIn(
  ctx: BudgetSpendContext,
  budget: BudgetLike & { rollover: BudgetRollover; period: BudgetPeriod; amount: Prisma.Decimal | number },
  current: BudgetWindow,
  pay: Date[] | null,
): number {
  const cats = budgetCategorySet(budget.categoryId, ctx.categories);
  const spent = carryWindows(budget, current, pay).map((w) => sumBudgetSpent(ctx.lines, budget, w, cats).spent);
  return foldCarry(Number(budget.amount), budget.rollover, spent);
}
