import type { AnalysisPeriod, ExpenseKind, SpendingAnalysis, SpendingLine } from '../../types';

// ── Modello della sezione Analisi ────────────────────────────────────────────
//   Funzioni PURE sulle righe di spesa restituite da /analytics/spending: tutte
//   le aggregazioni (periodi, categorie, abitudini) vivono qui, testate, e i
//   componenti si limitano a mostrarle.
//
//   Regola dei confronti: un periodo si confronta con la MEDIA degli altri
//   periodi chiusi. Se il periodo scelto è quello in corso (incompleto), il
//   confronto è "alla stessa data": per ogni periodo chiuso si somma solo ciò che
//   era stato speso entro lo stesso numero di giorni dall'inizio. Così a metà
//   periodo non sembra di aver speso la metà del solito.

export const KINDS: { id: ExpenseKind; label: string; hint: string }[] = [
  { id: 'fixed', label: 'Fisse', hint: 'Generate dalle ricorrenti' },
  { id: 'planned', label: 'Programmate', hint: 'Pianificate e rate registrate' },
  { id: 'variable', label: 'Variabili', hint: 'Tutto il resto: il ritmo quotidiano' },
];

export const UNCATEGORIZED = 'uncategorized';

const DAY_MS = 86_400_000;
const toDay = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};
export const dayOffset = (fromIso: string, toIso: string) => Math.round((toDay(toIso) - toDay(fromIso)) / DAY_MS);

const round2 = (n: number) => Math.round(n * 100) / 100;
const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);

export const periodIndexOf = (date: string, periods: AnalysisPeriod[]) =>
  periods.findIndex((p) => date >= p.start && date < p.end);

// Righe di un periodo, eventualmente solo entro i primi `withinDays` giorni.
export function linesIn(lines: SpendingLine[], period: AnalysisPeriod, withinDays?: number): SpendingLine[] {
  return lines.filter((l) => {
    if (l.date < period.start || l.date >= period.end) return false;
    return withinDays === undefined || dayOffset(period.start, l.date) < withinDays;
  });
}

const sum = (lines: SpendingLine[]) => lines.reduce((s, l) => s + l.amount, 0);

// Indici dei periodi di confronto per `selected`: gli altri periodi chiusi.
export const comparisonIndexes = (periods: AnalysisPeriod[], selected: number) =>
  periods.map((_, i) => i).filter((i) => i !== selected && !periods[i].isCurrent);

// Giorni su cui confrontare: tutto il periodo se chiuso, i giorni trascorsi se in corso.
const cutoffFor = (p: AnalysisPeriod) => (p.isCurrent ? p.elapsedDays : undefined);

// ── Totali per periodo ──

export interface PeriodTotals {
  fixed: number;
  planned: number;
  variable: number;
  total: number;
  income: number;
  saved: number;
  savingsRate: number | null;  // (entrate − spese) / entrate
  variablePerDay: number;      // variabili / giorni trascorsi
}

export function periodTotals(data: SpendingAnalysis): PeriodTotals[] {
  return data.periods.map((p, i) => {
    const ls = linesIn(data.lines, p);
    const byKind = (k: ExpenseKind) => round2(sum(ls.filter((l) => l.kind === k)));
    const fixed = byKind('fixed');
    const planned = byKind('planned');
    const variable = byKind('variable');
    const total = round2(fixed + planned + variable);
    const income = data.income[i] ?? 0;
    return {
      fixed, planned, variable, total, income,
      saved: round2(income - total),
      savingsRate: income > 0 ? (income - total) / income : null,
      variablePerDay: round2(variable / Math.max(1, p.elapsedDays)),
    };
  });
}

// ── Confronto del periodo scelto con la media ──

export interface PeriodComparison {
  total: number;
  avgTotal: number | null;         // media degli altri periodi (alla stessa data se in corso)
  variablePerDay: number;
  avgVariablePerDay: number | null;
  comparedPeriods: number;
  sameDate: boolean;               // confronto alla stessa data (periodo in corso)
}

export function comparePeriod(data: SpendingAnalysis, selected: number): PeriodComparison {
  const p = data.periods[selected];
  const cutoff = cutoffFor(p);
  const others = comparisonIndexes(data.periods, selected);
  const total = sum(linesIn(data.lines, p));
  const variable = sum(linesIn(data.lines, p).filter((l) => l.kind === 'variable'));
  const otherTotals = others.map((i) => sum(linesIn(data.lines, data.periods[i], cutoff)));
  const otherRates = others.map((i) => {
    const q = data.periods[i];
    return sum(linesIn(data.lines, q).filter((l) => l.kind === 'variable')) / Math.max(1, q.days);
  });
  const avgTotal = mean(otherTotals);
  const avgRate = mean(otherRates);
  return {
    total: round2(total),
    avgTotal: avgTotal === null ? null : round2(avgTotal),
    variablePerDay: round2(variable / Math.max(1, p.elapsedDays)),
    avgVariablePerDay: avgRate === null ? null : round2(avgRate),
    comparedPeriods: others.length,
    sameDate: p.isCurrent,
  };
}

// Stima della spesa a fine periodo (solo periodo in corso): speso finora +
// impegni attesi + variabili al ritmo medio dei periodi chiusi per i giorni che mancano.
export function periodOutlook(data: SpendingAnalysis, selected: number, cmp: PeriodComparison): number | null {
  const p = data.periods[selected];
  if (!p.isCurrent) return null;
  const remainingDays = Math.max(0, p.days - p.elapsedDays);
  const rate = cmp.avgVariablePerDay ?? cmp.variablePerDay;
  return round2(cmp.total + data.knownRemaining + rate * remainingDays);
}

// ── Categorie ──

export interface CategoryRow {
  id: string;                  // categoryId o UNCATEGORIZED
  name: string;
  color: string | null;
  icon: string | null;
  total: number;               // nel periodo scelto
  avg: number | null;          // media degli altri periodi (alla stessa data se in corso)
  delta: number | null;        // total − avg
  deltaPct: number | null;
  share: number;               // quota sul totale del periodo scelto (0–1)
  count: number;
  avgTicket: number;
  series: number[];            // totale per periodo (tutti i periodi)
}

export function categoryRows(data: SpendingAnalysis, selected: number): CategoryRow[] {
  const p = data.periods[selected];
  const cutoff = cutoffFor(p);
  const others = comparisonIndexes(data.periods, selected);
  const catById = new Map(data.categories.map((c) => [c.id, c]));
  const keyOf = (l: SpendingLine) => l.categoryId ?? UNCATEGORIZED;

  const keys = new Set(data.lines.map(keyOf));
  const periodTotal = sum(linesIn(data.lines, p));

  const rows: CategoryRow[] = [];
  for (const key of keys) {
    const mine = data.lines.filter((l) => keyOf(l) === key);
    const sel = linesIn(mine, p);
    const total = sum(sel);
    const avgRaw = mean(others.map((i) => sum(linesIn(mine, data.periods[i], cutoff))));
    const cat = key === UNCATEGORIZED ? null : catById.get(key);
    const avg = avgRaw === null ? null : round2(avgRaw);
    if (total === 0 && !avg) continue;
    rows.push({
      id: key,
      name: cat?.name ?? 'Senza categoria',
      color: cat?.color ?? null,
      icon: cat?.icon ?? null,
      total: round2(total),
      avg,
      delta: avg === null ? null : round2(total - avg),
      deltaPct: avg ? (total - avg) / avg : null,
      share: periodTotal > 0 ? total / periodTotal : 0,
      count: new Set(sel.map((l) => l.txId)).size,
      avgTicket: sel.length ? round2(total / new Set(sel.map((l) => l.txId)).size) : 0,
      series: data.periods.map((q) => round2(sum(linesIn(mine, q)))),
    });
  }
  return rows.sort((a, b) => b.total - a.total || (b.avg ?? 0) - (a.avg ?? 0));
}

// Scostamento "notevole": almeno ±25% e almeno 15 € rispetto alla media, oppure
// una categoria nuova (media zero) da almeno 15 €.
export const isNotable = (r: CategoryRow) =>
  r.delta !== null && Math.abs(r.delta) >= 15 && (r.deltaPct === null || Math.abs(r.deltaPct) >= 0.25);

// ── Abitudini ──

export const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
const weekdayOf = (iso: string) => (new Date(toDay(iso)).getUTCDay() + 6) % 7; // 0 = lunedì

// Spesa variabile media per giorno della settimana sui periodi indicati (solo
// giorni già trascorsi): totale del weekday / quante volte quel weekday ricorre.
export function weekdayProfile(data: SpendingAnalysis, indexes: number[]): { day: string; avg: number; total: number }[] {
  const totals = new Array(7).fill(0);
  const occurrences = new Array(7).fill(0);
  for (const i of indexes) {
    const p = data.periods[i];
    for (let d = 0; d < p.elapsedDays; d++) {
      const iso = new Date(toDay(p.start) + d * DAY_MS).toISOString().slice(0, 10);
      occurrences[weekdayOf(iso)] += 1;
    }
    for (const l of linesIn(data.lines, p)) {
      if (l.kind === 'variable') totals[weekdayOf(l.date)] += l.amount;
    }
  }
  return WEEKDAYS.map((day, i) => ({
    day,
    total: round2(totals[i]),
    avg: round2(occurrences[i] ? totals[i] / occurrences[i] : 0),
  }));
}

export const SIZE_BUCKETS = [
  { label: 'fino a 10 €', max: 10 },
  { label: '10–25 €', max: 25 },
  { label: '25–50 €', max: 50 },
  { label: '50–100 €', max: 100 },
  { label: '100–250 €', max: 250 },
  { label: 'oltre 250 €', max: Infinity },
];

// Distribuzione degli importi delle spese variabili (per transazione, non per
// riga di split): quante piccole spese e quanto pesano sul totale.
export function sizeDistribution(lines: SpendingLine[]): { label: string; count: number; total: number; share: number }[] {
  const byTx = new Map<string, number>();
  for (const l of lines) if (l.kind === 'variable') byTx.set(l.txId, (byTx.get(l.txId) ?? 0) + l.amount);
  const amounts = Array.from(byTx.values());
  const grand = amounts.reduce((s, a) => s + a, 0);
  let lower = 0;
  return SIZE_BUCKETS.map((b) => {
    const inB = amounts.filter((a) => a > lower && a <= b.max);
    lower = b.max;
    const total = inB.reduce((s, a) => s + a, 0);
    return { label: b.label, count: inB.length, total: round2(total), share: grand > 0 ? total / grand : 0 };
  });
}

// Descrizioni ricorrenti (esercenti/voci abituali): normalizzate per confronto.
export const normalizeDescription = (d: string | null) =>
  (d ?? '').toLowerCase().replace(/\s+/g, ' ').trim();

export interface FrequentItem {
  key: string;
  label: string;          // descrizione come scritta l'ultima volta
  count: number;
  total: number;
  avg: number;
  lastDate: string;
  categoryId: string | null;
}

export function frequentDescriptions(lines: SpendingLine[], minCount = 2): FrequentItem[] {
  const byKey = new Map<string, { label: string; tx: Map<string, number>; lastDate: string; categoryId: string | null }>();
  for (const l of lines) {
    const key = normalizeDescription(l.description);
    if (!key) continue;
    const e = byKey.get(key) ?? { label: l.description ?? key, tx: new Map(), lastDate: l.date, categoryId: l.categoryId };
    e.tx.set(l.txId, (e.tx.get(l.txId) ?? 0) + l.amount);
    if (l.date >= e.lastDate) {
      e.lastDate = l.date;
      e.label = l.description ?? key;
      e.categoryId = l.categoryId;
    }
    byKey.set(key, e);
  }
  return Array.from(byKey.entries())
    .map(([key, e]) => {
      const total = Array.from(e.tx.values()).reduce((s, a) => s + a, 0);
      return { key, label: e.label, count: e.tx.size, total: round2(total), avg: round2(total / e.tx.size), lastDate: e.lastDate, categoryId: e.categoryId };
    })
    .filter((f) => f.count >= minCount)
    .sort((a, b) => b.total - a.total);
}

// Spesa per giorno del periodo (tutte le nature + quota variabile), per il calendario.
export function dailySpending(data: SpendingAnalysis, selected: number): { date: string; total: number; variable: number; future: boolean }[] {
  const p = data.periods[selected];
  const ls = linesIn(data.lines, p);
  return Array.from({ length: p.days }, (_, d) => {
    const date = new Date(toDay(p.start) + d * DAY_MS).toISOString().slice(0, 10);
    const day = ls.filter((l) => l.date === date);
    return {
      date,
      total: round2(sum(day)),
      variable: round2(sum(day.filter((l) => l.kind === 'variable'))),
      future: date > data.today,
    };
  });
}
