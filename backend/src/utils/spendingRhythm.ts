import prisma from './prisma';
import { expandToCategoryLines } from './categoryContributions';
import { addDays, daysBetween, startOfDay, type PayPeriodInfo, type PeriodRange } from './payPeriod';

// ── Ritmo quotidiano (spesa variabile) ───────────────────────────────────────
//
//   Stima quanto si spende al giorno OLTRE agli impegni già noti alla proiezione
//   (ricorrenti, pianificate, rate, addebiti carta). Base: gli ultimi periodi di
//   paga chiusi. Si contano gli ACQUISTI (anche su carta, alla data d'acquisto) ed
//   si escludono:
//     • trasferimenti tra conti;
//     • transazioni generate da ricorrenti (fromRecurringId) o da pianificate/rate
//       (fromPlannedId, più un ripiego euristico per lo storico senza collegamento);
//     • la categoria di sistema "Pagamento Carta" (addebito aggregato del ciclo:
//       le spese vere sono già contate come acquisti sulla carta).
//   Il tasso è la MEDIANA dei tassi giornalieri dei periodi (robusta a un periodo
//   eccezionale); la fascia è [min, max] dei periodi.

export interface RhythmLine {
  date: Date;
  amount: number;
  accountId: string | null;
  categoryId: string | null;
  categoryName: string;
  color: string | null;
  icon: string | null;
}

export interface RhythmPeriodStat {
  start: string; // YYYY-MM-DD
  end: string;   // YYYY-MM-DD (escluso)
  days: number;
  spent: number;
  rate: number;
}

export interface RhythmCategory {
  categoryId: string | null;
  name: string;
  color: string | null;
  icon: string | null;
  daily: number;
  share: number; // 0–1
}

export interface SpendingRhythm {
  basis: 'periods' | 'current' | 'none';
  dailyRate: number;
  low: number;
  high: number;
  periods: RhythmPeriodStat[];
  current: { start: string; days: number; spent: number; rate: number };
  // Quota della spesa variabile per conto ('none' = transazioni senza conto).
  shareByAccount: Record<string, number>;
  topCategories: RhythmCategory[];
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

export const isoDay = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const median = (values: number[]): number => {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

// Con meno giorni di così il ritmo del periodo corrente è troppo rumoroso per
// fare da base (usato solo se non esiste nessun periodo chiuso con dati).
const MIN_CURRENT_DAYS = 7;
const TOP_CATEGORIES = 5;

// Funzione PURA (testabile).
//   lines         : righe di spesa variabile (già filtrate), anche fuori dai periodi.
//   periods       : periodi chiusi candidati (dal più vecchio).
//   activityDates : date di TUTTE le transazioni registrate (qualsiasi tipo). Un
//                   periodo è usabile solo se inizia dopo il primo movimento e ne
//                   contiene almeno uno: un periodo "vuoto" perché l'app non era
//                   usata abbasserebbe falsamente il ritmo.
export function estimateRhythm(
  lines: RhythmLine[],
  periods: PeriodRange[],
  activityDates: Date[],
  currentStart: Date,
  now: Date,
): SpendingRhythm {
  const today = startOfDay(now);
  const inRange = (l: { date: Date }, start: Date, endExcl: Date) => l.date >= start && l.date < endExcl;

  const firstActivity = activityDates.reduce<Date | null>((m, d) => (!m || d < m ? d : m), null);
  const valid = firstActivity
    ? periods.filter((p) => p.start >= startOfDay(firstActivity) && activityDates.some((d) => inRange({ date: d }, p.start, p.end)))
    : [];
  const periodStats: RhythmPeriodStat[] = valid.map((p) => {
    const days = Math.max(1, daysBetween(p.start, p.end));
    const spent = lines.filter((l) => inRange(l, p.start, p.end)).reduce((s, l) => s + l.amount, 0);
    return { start: isoDay(p.start), end: isoDay(p.end), days, spent: round2(spent), rate: round2(spent / days) };
  });

  const tomorrow = addDays(today, 1);
  const currentDays = Math.max(1, daysBetween(currentStart, today) + 1);
  const currentSpent = lines.filter((l) => inRange(l, currentStart, tomorrow)).reduce((s, l) => s + l.amount, 0);
  const current = {
    start: isoDay(currentStart),
    days: currentDays,
    spent: round2(currentSpent),
    rate: round2(currentSpent / currentDays),
  };

  let basis: SpendingRhythm['basis'];
  let dailyRate: number;
  let low: number;
  let high: number;
  let baseLines: RhythmLine[];

  if (periodStats.length > 0) {
    basis = 'periods';
    const rates = periodStats.map((p) => p.spent / p.days);
    dailyRate = median(rates);
    low = Math.min(...rates);
    high = Math.max(...rates);
    const first = valid[0].start;
    const last = valid[valid.length - 1].end;
    baseLines = lines.filter((l) => inRange(l, first, last));
  } else if (currentDays >= MIN_CURRENT_DAYS && currentSpent > 0) {
    basis = 'current';
    dailyRate = currentSpent / currentDays;
    low = dailyRate;
    high = dailyRate;
    baseLines = lines.filter((l) => inRange(l, currentStart, tomorrow));
  } else {
    basis = 'none';
    dailyRate = 0;
    low = 0;
    high = 0;
    baseLines = [];
  }

  const baseTotal = baseLines.reduce((s, l) => s + l.amount, 0);
  const baseDays = basis === 'periods'
    ? periodStats.reduce((s, p) => s + p.days, 0)
    : basis === 'current' ? currentDays : 1;

  const shareByAccount: Record<string, number> = {};
  const byCat = new Map<string, { line: RhythmLine; total: number }>();
  for (const l of baseLines) {
    const acc = l.accountId ?? 'none';
    shareByAccount[acc] = (shareByAccount[acc] ?? 0) + l.amount;
    const key = l.categoryId ?? 'uncategorized';
    const entry = byCat.get(key);
    if (entry) entry.total += l.amount;
    else byCat.set(key, { line: l, total: l.amount });
  }
  if (baseTotal > 0) {
    for (const k of Object.keys(shareByAccount)) shareByAccount[k] = shareByAccount[k] / baseTotal;
  }

  const topCategories: RhythmCategory[] = Array.from(byCat.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, TOP_CATEGORIES)
    .map(({ line, total }) => ({
      categoryId: line.categoryId,
      name: line.categoryName,
      color: line.color,
      icon: line.icon,
      daily: round2(total / baseDays),
      share: baseTotal > 0 ? round2(total / baseTotal) : 0,
    }));

  return {
    basis,
    dailyRate: round2(dailyRate),
    low: round2(low),
    high: round2(high),
    periods: periodStats,
    current,
    shareByAccount,
    topCategories,
  };
}

// ── Caricamento dal DB ───────────────────────────────────────────────────────

// Tolleranza per riconoscere, nello storico senza fromPlannedId, una transazione
// nata da una pianificata pagata (stesso importo/tipo/descrizione, data vicina).
const LEGACY_PLANNED_MATCH_DAYS = 20;

// Natura di una spesa:
//   fixed    → generata da una ricorrente (fromRecurringId);
//   planned  → nata da una pianificata o da una rata (fromPlannedId, o ripiego
//              euristico per lo storico precedente al collegamento);
//   variable → tutto il resto (il "ritmo quotidiano").
export type ExpenseKind = 'fixed' | 'planned' | 'variable';

export interface ClassifiedExpenseLine extends RhythmLine {
  txId: string;
  description: string | null;
  kind: ExpenseKind;
}

// Spese reali nel range, alla data d'ACQUISTO (carte incluse), già espanse per
// categoria (split) e classificate. Esclusi trasferimenti e la categoria di
// sistema "Pagamento Carta" (l'addebito aggregato del ciclo: le spese vere sono
// già gli acquisti sulla carta). Fonte unica per ritmo quotidiano e analisi spese.
export async function loadClassifiedExpenses(
  userId: string,
  from: Date,
  to: Date,
  // null = utente senza conti (nessun filtro). Con conti, le transazioni SENZA
  // conto restano fuori di proposito: come in getLiquidBalance/bankAccountScope.
  accountIds: string[] | null,
): Promise<ClassifiedExpenseLine[]> {
  const [txns, paidPlanned, plans] = await Promise.all([
    prisma.transaction.findMany({
      where: {
        userId,
        type: 'EXPENSE',
        transferId: null,
        date: { gte: from, lte: to },
        ...(accountIds ? { accountId: { in: accountIds } } : {}),
        OR: [{ categoryId: null }, { category: { isSystem: false } }],
      },
      include: { category: true, items: { include: { category: true } } },
      orderBy: { date: 'asc' },
    }),
    prisma.plannedTransaction.findMany({
      where: {
        userId,
        type: 'EXPENSE',
        isPaid: true,
        plannedDate: { gte: addDays(from, -LEGACY_PLANNED_MATCH_DAYS), lte: addDays(to, LEGACY_PLANNED_MATCH_DAYS) },
      },
      select: { amount: true, description: true, plannedDate: true },
    }),
    prisma.installmentPlan.findMany({ where: { userId }, select: { title: true } }),
  ]);

  // Ripiego per lo storico precedente a fromPlannedId.
  const isLegacyPlanned = (t: { amount: unknown; description: string | null; date: Date }) => {
    const desc = t.description ?? '';
    if (plans.some((p) => desc.startsWith(`${p.title} — `))) return true;
    const amount = Number(t.amount);
    return paidPlanned.some(
      (p) =>
        p.plannedDate &&
        Math.abs(Number(p.amount) - amount) < 0.005 &&
        p.description === desc &&
        Math.abs(daysBetween(p.plannedDate, t.date)) <= LEGACY_PLANNED_MATCH_DAYS,
    );
  };

  const lines: ClassifiedExpenseLine[] = [];
  for (const t of txns) {
    const kind: ExpenseKind = t.fromRecurringId
      ? 'fixed'
      : t.fromPlannedId || isLegacyPlanned(t) ? 'planned' : 'variable';
    for (const line of expandToCategoryLines(t)) {
      lines.push({
        txId: t.id,
        description: t.description,
        kind,
        date: t.date,
        amount: line.amount,
        accountId: t.accountId,
        categoryId: line.categoryId ?? null,
        categoryName: line.category?.name || 'Senza categoria',
        color: line.category?.color ?? null,
        icon: line.category?.icon ?? null,
      });
    }
  }
  return lines;
}

export async function loadSpendingRhythm(
  userId: string,
  payPeriod: PayPeriodInfo,
  accountIds: string[] | null,
  now: Date = new Date(),
): Promise<SpendingRhythm> {
  const first = payPeriod.completedPeriods[0]?.start ?? payPeriod.start;
  const from = first < payPeriod.start ? first : payPeriod.start;

  const [expenses, firstTxn, activity] = await Promise.all([
    loadClassifiedExpenses(userId, from, now, accountIds),
    prisma.transaction.findFirst({ where: { userId }, orderBy: { date: 'asc' }, select: { date: true } }),
    prisma.transaction.findMany({
      where: { userId, date: { gte: from, lte: now }, ...(accountIds ? { accountId: { in: accountIds } } : {}) },
      select: { date: true },
    }),
  ]);
  const lines: RhythmLine[] = expenses.filter((l) => l.kind === 'variable');

  // Il primo movimento assoluto (anche fuori finestra) marca l'inizio dei dati.
  const activityDates = [...(firstTxn ? [firstTxn.date] : []), ...activity.map((t) => t.date)];
  return estimateRhythm(lines, payPeriod.completedPeriods, activityDates, payPeriod.start, now);
}
