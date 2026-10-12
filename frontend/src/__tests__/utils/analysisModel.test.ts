import { describe, it, expect } from 'vitest';
import {
  periodTotals, comparePeriod, periodOutlook, categoryRows, isNotable, natureTotals,
  weekdayProfile, sizeDistribution, frequentDescriptions, dailySpending, UNCATEGORIZED,
  matchesFocus, focusPurchases, focusSummary, focusBuckets, focusDelta, weekRanges, topDescriptions,
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

describe('macro-categorie e natura', () => {
  const withTree = (lines: SpendingLine[]) => data(lines, {
    categories: [
      { id: 'eat', name: 'Ristoranti e bar', color: null, icon: null, parentId: null, nature: 'DISCRETIONARY' },
      { id: 'bar', name: 'Bar', color: null, icon: null, parentId: 'eat' },
      { id: 'pizza', name: 'Pizzeria', color: null, icon: null, parentId: 'eat' },
      { id: 'food', name: 'Spesa', color: null, icon: null, parentId: null, nature: 'ESSENTIAL' },
    ],
  });

  it('per macro somma le sotto-categorie; per categoria restano separate', () => {
    const d = withTree([
      line('2026-08-22', 5, { categoryId: 'bar' }),
      line('2026-08-23', 25, { categoryId: 'pizza' }),
      line('2026-08-23', 40, { categoryId: 'food' }),
    ]);
    const macro = categoryRows(d, 2, 'macro');
    expect(macro.find((r) => r.id === 'eat')).toMatchObject({ name: 'Ristoranti e bar', total: 30, count: 2 });
    expect(categoryRows(d, 2, 'leaf').map((r) => r.id).sort()).toEqual(['bar', 'food', 'pizza']);
  });

  it('spesa per natura della macro', () => {
    const d = withTree([
      line('2026-08-22', 5, { categoryId: 'bar' }),
      line('2026-08-23', 40, { categoryId: 'food' }),
      line('2026-08-23', 10, { categoryId: null }),
    ]);
    expect(natureTotals(d, 2)).toEqual({ essential: 40, discretionary: 5, unset: 10 });
  });
});

describe('focus categoria', () => {
  const cats = [
    { id: 'food', name: 'Spesa', color: null, icon: null },
    { id: 'bar', name: 'Bar', color: null, icon: null, parentId: 'food' },
    { id: 'fun', name: 'Svago', color: null, icon: null },
  ];
  const lines = [
    line('2026-08-02', 4, { categoryId: 'bar', description: 'Caffè ', txId: 'a' }),
    line('2026-08-05', 6, { categoryId: 'bar', description: 'caffè', txId: 'b' }),
    line('2026-08-05', 30, { categoryId: 'food', description: 'Super', txId: 'c' }),
    line('2026-08-05', 5, { categoryId: 'fun', description: 'Super', txId: 'c' }),  // split di c su un'altra categoria
    line('2026-08-12', 10, { categoryId: 'food', description: 'Super', txId: 'd' }),
    line('2026-08-12', 2, { categoryId: 'food', description: 'Super', txId: 'd' }), // due righe, stessa transazione
    line('2026-08-22', 8, { categoryId: 'fun', txId: 'e' }),
  ];

  it('macro include le sotto-categorie, la sotto-categoria vale da sola, split sulla categoria giusta', () => {
    const d = data(lines, { categories: cats });
    const macro = focusPurchases(lines.filter((l) => matchesFocus(d, l, 'food')));
    expect(macro.map((p) => [p.txId, p.amount])).toEqual([['a', 4], ['b', 6], ['c', 30], ['d', 12]]);
    expect(lines.filter((l) => matchesFocus(d, l, 'bar'))).toHaveLength(2);
    expect(lines.filter((l) => matchesFocus(d, l, 'fun')).map((l) => l.amount)).toEqual([5, 8]);
  });

  it('sintesi: conteggio, importo medio, giorni medi tra acquisti, ultimo acquisto', () => {
    const p = focusPurchases([line('2026-08-02', 10), line('2026-08-06', 20), line('2026-08-12', 30)]);
    expect(focusSummary(p)).toEqual({ count: 3, total: 60, avgAmount: 20, avgGapDays: 5, lastDate: '2026-08-12' });
    expect(focusSummary(p.slice(0, 1)).avgGapDays).toBeNull();
    expect(focusSummary([])).toEqual({ count: 0, total: 0, avgAmount: null, avgGapDays: null, lastDate: null });
  });

  it("bucket settimanali: 7 giorni dall'inizio, nel periodo in corso solo fino ai giorni trascorsi", () => {
    const closed = weekRanges(periods[1]); // 10 giorni
    expect(closed).toEqual([
      { start: '2026-08-11', end: '2026-08-18', last: '2026-08-17' },
      { start: '2026-08-18', end: '2026-08-21', last: '2026-08-20' },
    ]);
    expect(weekRanges(periods[2])).toHaveLength(1); // 5 giorni trascorsi
    const b = focusBuckets(focusPurchases([line('2026-08-12', 10), line('2026-08-17', 5), line('2026-08-19', 7)]), closed);
    expect(b.map((x) => [x.count, x.total])).toEqual([[2, 15], [1, 7]]);
  });

  it('bucket: riga sul confine (end escluso) va nel bucket successivo; ultimo giorno corretto anche con TZ Europe/Rome; bucket finale di 1 giorno', () => {
    const prevTZ = process.env.TZ;
    process.env.TZ = 'Europe/Rome';
    try {
      const r = weekRanges({ start: '2026-08-01', end: '2026-08-16', days: 15, elapsedDays: 15, isCurrent: false });
      expect(r.map((x) => [x.start, x.last])).toEqual([['2026-08-01', '2026-08-07'], ['2026-08-08', '2026-08-14'], ['2026-08-15', '2026-08-15']]);
      const b = focusBuckets(focusPurchases([line('2026-08-08', 1), line('2026-08-15', 2)]), r);
      expect(b.map((x) => x.count)).toEqual([0, 1, 1]);
    } finally {
      if (prevTZ === undefined) delete process.env.TZ; else process.env.TZ = prevTZ;
    }
  });

  it('periodo in corso con più di 7 giorni trascorsi: due settimane, nessuna nel futuro', () => {
    const r = weekRanges({ ...periods[2], days: 30, elapsedDays: 12 });
    expect(r.map((x) => x.start)).toEqual(['2026-08-21', '2026-08-28']);
  });

  it('matchesFocus: righe senza categoria non corrispondono mai', () => {
    const d = data([], { categories: cats });
    expect(matchesFocus(d, line('2026-08-02', 1, { categoryId: null }), 'food')).toBe(false);
  });

  it('topDescrizioni rispetta il limite di 8', () => {
    const many = Array.from({ length: 10 }, (_, i) => line('2026-08-02', 1 + i, { description: `voce ${i}` }));
    expect(topDescriptions(many)).toHaveLength(8);
  });

  it('delta vs periodo precedente, alla stessa data se in corso; null senza precedente', () => {
    const d = data([
      line('2026-08-12', 10, { txId: 'p1' }),
      line('2026-08-20', 10, { txId: 'p2' }),
      line('2026-08-22', 30, { txId: 'c1' }),
    ], { categories: cats });
    // corrente: 1 acquisto da 30; precedente entro i primi 5 giorni: solo p1 (10)
    expect(focusDelta(d, 'food', 2)).toEqual({ count: 0, total: 20 });
    expect(focusDelta(d, 'food', 1)).toEqual({ count: 2, total: 20 });
    expect(focusDelta(d, 'food', 0)).toBeNull();
  });

  it('top descrizioni: normalizza maiuscole/spazi, ordina per numero di acquisti poi spesa', () => {
    const top = topDescriptions([
      line('2026-08-02', 4, { description: 'Caffè ', txId: 'a' }),
      line('2026-08-03', 6, { description: 'caffè', txId: 'b' }),
      line('2026-08-04', 50, { description: 'Super', txId: 'c' }),
      line('2026-08-05', 1, { description: null, txId: 'd' }),
    ]);
    expect(top.map((t) => [t.key, t.count, t.total])).toEqual([['caffè', 2, 10], ['super', 1, 50]]);
  });
});

