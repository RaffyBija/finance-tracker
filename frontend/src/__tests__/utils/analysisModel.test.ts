import { describe, it, expect } from 'vitest';
import {
  periodTotals, comparePeriod, periodOutlook, categoryRows, isNotable,
  weekdayProfile, sizeDistribution, frequentDescriptions, dailySpending, UNCATEGORIZED,
} from '../../components/analysis/model';
import type { SpendingAnalysis, SpendingLine } from '../../types';

// Tre periodi da 10 giorni; l'ultimo è in corso (5 giorni trascorsi).
const periods = [
  { start: '2026-08-01', end: '2026-08-11', days: 10, elapsedDays: 10, isCurrent: false },
  { start: '2026-08-11', end: '2026-08-21', days: 10, elapsedDays: 10, isCurrent: false },
  { start: '2026-08-21', end: '2026-08-31', days: 10, elapsedDays: 5, isCurrent: true },
];

let n = 0;
const line = (date: string, amount: number, over: Partial<SpendingLine> = {}): SpendingLine => ({
  date, amount, categoryId: 'food', kind: 'variable', accountId: 'a1', description: null, txId: `t${n++}`, ...over,
});

const data = (lines: SpendingLine[], over: Partial<SpendingAnalysis> = {}): SpendingAnalysis => ({
  mode: 'pay',
  payPeriodConfigured: true,
  today: '2026-08-25',
  periods,
  income: [1000, 1000, 1000],
  knownRemaining: 0,
  lines,
  categories: [{ id: 'food', name: 'Spesa', color: '#10b981', icon: null }, { id: 'fun', name: 'Svago', color: null, icon: null }],
  accounts: [],
  ...over,
});

describe('periodTotals', () => {
  it('somma per natura, risparmio e variabili al giorno sui giorni trascorsi', () => {
    const d = data([
      line('2026-08-02', 100),
      line('2026-08-03', 50, { kind: 'fixed' }),
      line('2026-08-22', 40),
      line('2026-08-23', 10, { kind: 'planned' }),
    ]);
    const t = periodTotals(d);
    expect(t[0]).toMatchObject({ fixed: 50, planned: 0, variable: 100, total: 150, saved: 850, variablePerDay: 10 });
    expect(t[0].savingsRate).toBeCloseTo(0.85);
    expect(t[2]).toMatchObject({ variable: 40, planned: 10, total: 50, variablePerDay: 8 });
  });
});

describe('comparePeriod', () => {
  it('periodo in corso: confronto alla stessa data (primi 5 giorni degli altri periodi)', () => {
    const d = data([
      line('2026-08-02', 100),   // giorno 2 del P1 → dentro i primi 5
      line('2026-08-09', 900),   // giorno 9 del P1 → fuori
      line('2026-08-12', 60),    // giorno 2 del P2 → dentro
      line('2026-08-22', 30),    // in corso
    ]);
    const c = comparePeriod(d, 2);
    expect(c.sameDate).toBe(true);
    expect(c.avgTotal).toBe(80);           // (100 + 60) / 2
    expect(c.comparedPeriods).toBe(2);
    expect(c.variablePerDay).toBe(6);      // 30 / 5
    expect(c.avgVariablePerDay).toBe(53);  // ((1000/10) + (60/10)) / 2
  });

  it('periodo chiuso: confronto con l\'altro periodo chiuso intero', () => {
    const d = data([line('2026-08-02', 100), line('2026-08-09', 900), line('2026-08-12', 60)]);
    const c = comparePeriod(d, 1);
    expect(c.avgTotal).toBe(1000);
    expect(c.comparedPeriods).toBe(1);
    expect(c.sameDate).toBe(false);
  });

  it('stima a fine periodo = speso + impegni attesi + ritmo medio × giorni mancanti', () => {
    const d = data([line('2026-08-02', 100), line('2026-08-12', 100), line('2026-08-22', 30)], { knownRemaining: 20 });
    const c = comparePeriod(d, 2);
    expect(periodOutlook(d, 2, c)).toBe(30 + 20 + 10 * 5);
    expect(periodOutlook(d, 1, comparePeriod(d, 1))).toBeNull();
  });
});

describe('categoryRows', () => {
  it('totali, media, scostamento, quota e scontrino medio per categoria', () => {
    const d = data([
      line('2026-08-02', 100),
      line('2026-08-12', 100),
      line('2026-08-12', 20, { categoryId: 'fun' }),
      line('2026-08-22', 150),
      line('2026-08-23', 50),
      line('2026-08-23', 30, { categoryId: null }),
    ]);
    const rows = categoryRows(d, 2);
    const food = rows.find((r) => r.id === 'food')!;
    expect(food).toMatchObject({ total: 200, avg: 100, delta: 100, count: 2, avgTicket: 100, series: [100, 100, 200] });
    expect(food.deltaPct).toBeCloseTo(1);
    expect(food.share).toBeCloseTo(200 / 230);
    expect(isNotable(food)).toBe(true);
    // Categoria assente nel periodo ma presente in media: resta visibile (calo).
    expect(rows.find((r) => r.id === 'fun')).toMatchObject({ total: 0, avg: 10 });
    expect(rows.find((r) => r.id === UNCATEGORIZED)?.name).toBe('Senza categoria');
  });
});

describe('abitudini', () => {
  it('media per giorno della settimana sui giorni trascorsi', () => {
    // 3 ago 2026 = lunedì; nel P1 i lunedì sono 3 e 10 ago.
    const d = data([line('2026-08-03', 30), line('2026-08-10', 10), line('2026-08-04', 7, { kind: 'fixed' })]);
    const prof = weekdayProfile(d, [0]);
    expect(prof[0]).toEqual({ day: 'Lun', total: 40, avg: 20 });
    expect(prof[1].total).toBe(0); // le fisse non contano
  });

  it('distribuzione degli importi per transazione (le righe di uno split si sommano)', () => {
    const lines = [
      line('2026-08-02', 5, { txId: 'a' }),
      line('2026-08-02', 30, { txId: 'b' }),
      line('2026-08-02', 30, { txId: 'b' }),
      line('2026-08-02', 300, { kind: 'fixed', txId: 'c' }),
    ];
    const dist = sizeDistribution(lines);
    expect(dist[0]).toMatchObject({ count: 1, total: 5 });
    expect(dist[3]).toMatchObject({ count: 1, total: 60 }); // 50–100 €
    expect(dist.reduce((s, b) => s + b.count, 0)).toBe(2);
  });

  it('descrizioni frequenti normalizzate', () => {
    const lines = [
      line('2026-08-02', 20, { description: 'Esselunga ' }),
      line('2026-08-09', 30, { description: 'esselunga' }),
      line('2026-08-10', 5, { description: 'Bar' }),
    ];
    const f = frequentDescriptions(lines);
    expect(f).toHaveLength(1);
    expect(f[0]).toMatchObject({ key: 'esselunga', label: 'esselunga', count: 2, total: 50, avg: 25, lastDate: '2026-08-09' });
  });

  it('spesa giornaliera del periodo con i giorni futuri marcati', () => {
    const d = data([line('2026-08-22', 12), line('2026-08-22', 8, { kind: 'fixed' })]);
    const days = dailySpending(d, 2);
    expect(days).toHaveLength(10);
    expect(days[1]).toEqual({ date: '2026-08-22', total: 20, variable: 12, future: false });
    expect(days[9].future).toBe(true);
  });
});
