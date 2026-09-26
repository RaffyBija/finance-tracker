import { describe, it, expect } from 'vitest';
import { estimateRhythm, type RhythmLine } from '../../utils/spendingRhythm';
import { buildRhythmEvents } from '../../utils/projection';
import type { AccountBalance } from '../../utils/balance';

const d = (y: number, m: number, day: number) => new Date(y, m - 1, day, 12);
const line = (date: Date, amount: number, accountId: string | null = 'bank', cat = 'food'): RhythmLine => ({
  date, amount, accountId, categoryId: cat, categoryName: cat, color: null, icon: null,
});

// Tre periodi da 30 giorni: 300 €, 600 €, 900 € → 10, 20, 30 €/giorno.
const PERIODS = [
  { start: new Date(2026, 5, 1), end: new Date(2026, 6, 1) },
  { start: new Date(2026, 6, 1), end: new Date(2026, 6, 31) },
  { start: new Date(2026, 6, 31), end: new Date(2026, 7, 30) },
];
const NOW = new Date(2026, 8, 4, 10);

describe('estimateRhythm', () => {
  it('usa la mediana dei tassi giornalieri e la fascia min–max', () => {
    const lines = [
      line(d(2026, 6, 10), 300),
      line(d(2026, 7, 10), 600),
      line(d(2026, 8, 10), 900),
    ];
    const r = estimateRhythm(lines, PERIODS, [new Date(2026, 0, 1), ...lines.map((l) => l.date)], new Date(2026, 7, 30), NOW);
    expect(r.basis).toBe('periods');
    expect(r.periods.map((p) => p.rate)).toEqual([10, 20, 30]);
    expect(r.dailyRate).toBe(20);
    expect(r.low).toBe(10);
    expect(r.high).toBe(30);
  });

  it('ignora i periodi precedenti ai primi dati reali', () => {
    const lines = [line(d(2026, 8, 10), 900)];
    const r = estimateRhythm(lines, PERIODS, [new Date(2026, 6, 31), d(2026, 8, 10)], new Date(2026, 7, 30), NOW);
    expect(r.periods).toHaveLength(1);
    expect(r.dailyRate).toBe(30);
  });

  it('ignora i periodi senza alcun movimento (app non usata), non li conta come spesa zero', () => {
    // Attività solo nel primo periodo.
    const lines = [line(d(2026, 6, 10), 300)];
    const r = estimateRhythm(lines, PERIODS, [d(2026, 5, 20), d(2026, 6, 10)], new Date(2026, 7, 30), NOW);
    expect(r.periods).toHaveLength(1);
    expect(r.dailyRate).toBe(10);
    // Un periodo con solo un'entrata (attività, ma spesa variabile zero) invece conta.
    const r2 = estimateRhythm(lines, PERIODS, [d(2026, 5, 20), d(2026, 6, 10), d(2026, 7, 5)], new Date(2026, 7, 30), NOW);
    expect(r2.periods.map((p) => p.rate)).toEqual([10, 0]);
    expect(r2.dailyRate).toBe(5);
  });

  it('senza periodi usa il periodo corrente solo con almeno 7 giorni', () => {
    const lines = [line(d(2026, 9, 2), 70)];
    const short = estimateRhythm(lines, PERIODS, [], new Date(2026, 7, 30), NOW); // 6 giorni
    expect(short.basis).toBe('none');
    expect(short.dailyRate).toBe(0);
    const long = estimateRhythm(lines, PERIODS, [], new Date(2026, 7, 29), NOW); // 7 giorni
    expect(long.basis).toBe('current');
    expect(long.dailyRate).toBe(10);
  });

  it('ripartisce la quota per conto e le categorie principali', () => {
    const lines = [
      line(d(2026, 7, 10), 450, 'bank', 'food'),
      line(d(2026, 7, 12), 150, 'cc', 'fuel'),
    ];
    const r = estimateRhythm(lines, PERIODS.slice(1, 2), [new Date(2026, 0, 1), ...lines.map((l) => l.date)], new Date(2026, 7, 30), NOW);
    expect(r.shareByAccount).toEqual({ bank: 0.75, cc: 0.25 });
    expect(r.topCategories.map((c) => [c.name, c.daily, c.share])).toEqual([['food', 15, 0.75], ['fuel', 5, 0.25]]);
  });
});

describe('buildRhythmEvents', () => {
  const bank: AccountBalance = { id: 'bank', type: 'BANK', openingBalance: 0, billingDay: null, closingDay: null, linkedAccountId: null, balance: 1000 };
  const other: AccountBalance = { ...bank, id: 'other' };
  const cc: AccountBalance = { id: 'cc', type: 'CREDIT_CARD', openingBalance: 0, billingDay: 15, closingDay: 31, linkedAccountId: 'bank', balance: 0 };
  const start = new Date(2026, 6, 6);
  const end = new Date(2026, 7, 20, 23, 59, 59, 999);

  it('quota BANK ogni giorno da domani, quota carta nell\'addebito del ciclo', () => {
    const events = buildRhythmEvents({
      rate: 10, shareByAccount: { bank: 0.5, cc: 0.5 }, accounts: [bank, cc], scopeId: null,
      rangeStart: start, rangeEnd: end, ccEvents: [], ccAccountsForCharge: [bank, cc], now: start,
    });
    const daily = events.filter((e) => e.amount === 5);
    expect(daily).toHaveLength(45); // 7 lug → 20 ago
    expect(daily[0].date.getDate()).toBe(7);
    // Spese su carta 7–31 lug (25 gg × 5 €) → addebito 15 ago.
    const charge = events.find((e) => e.amount !== 5)!;
    expect(charge.date.getMonth()).toBe(7);
    expect(charge.date.getDate()).toBe(15);
    expect(charge.amount).toBeCloseTo(125);
  });

  it('vista per conto: solo la quota del conto e delle sue carte', () => {
    const events = buildRhythmEvents({
      rate: 10, shareByAccount: { bank: 0.2, other: 0.8 }, accounts: [bank, other], scopeId: 'bank',
      rangeStart: start, rangeEnd: new Date(2026, 6, 8, 23, 59), ccEvents: [], ccAccountsForCharge: [], now: start,
    });
    expect(events.map((e) => e.amount)).toEqual([2, 2]);
  });

  it('non duplica il debito già maturato del ciclo aperto', () => {
    const indebted = { ...cc, balance: -200 };
    const events = buildRhythmEvents({
      rate: 10, shareByAccount: { cc: 1 }, accounts: [bank, indebted], scopeId: null,
      rangeStart: start, rangeEnd: end, ccEvents: [], ccAccountsForCharge: [bank, indebted], now: start,
    });
    expect(events).toHaveLength(1);
    expect(events[0].amount).toBeCloseTo(250); // solo il ritmo (25 gg × 10), non i 200 già maturati
  });
});
