import { describe, it, expect, vi } from 'vitest';

// dashboard.controller importa il singleton prisma e utils/balance: li mockiamo
// perché questi test toccano solo le funzioni pure di cadenza (nessun DB).
vi.mock('../../utils/prisma', () => ({ default: {} }));

import { listOccurrenceDates, countOccurrences, buildProjectedPoints } from '../../controllers/dashboard.controller';

type Rec = Parameters<typeof listOccurrenceDates>[0];
type Ev = Parameters<typeof buildProjectedPoints>[1][number];

const ymd = (d: Date) => ({ y: d.getFullYear(), m: d.getMonth(), d: d.getDate() });

describe('listOccurrenceDates — MONTHLY', () => {
  it('emette una data per mese sul dayOfMonth nel range', () => {
    const rec: Rec = { frequency: 'MONTHLY', dayOfMonth: 15, startDate: new Date(2026, 0, 1), endDate: null, amount: 100 };
    const dates = listOccurrenceDates(rec, new Date(2026, 0, 1), new Date(2026, 2, 31));
    expect(dates.map(ymd)).toEqual([
      { y: 2026, m: 0, d: 15 },
      { y: 2026, m: 1, d: 15 },
      { y: 2026, m: 2, d: 15 },
    ]);
  });

  it('clampa il giorno ai mesi corti (31 → ultimo giorno di febbraio)', () => {
    const rec: Rec = { frequency: 'MONTHLY', dayOfMonth: 31, startDate: new Date(2026, 0, 1), endDate: null, amount: 100 };
    const dates = listOccurrenceDates(rec, new Date(2026, 1, 1), new Date(2026, 1, 28));
    expect(dates.map(ymd)).toEqual([{ y: 2026, m: 1, d: 28 }]);
  });
});

describe('listOccurrenceDates — WEEKLY', () => {
  it('emette ogni 7 giorni a partire dalla startDate', () => {
    const rec: Rec = { frequency: 'WEEKLY', dayOfMonth: null, startDate: new Date(2026, 0, 5), endDate: null, amount: 50 };
    const dates = listOccurrenceDates(rec, new Date(2026, 0, 1), new Date(2026, 0, 31));
    expect(dates.map((d) => d.getDate())).toEqual([5, 12, 19, 26]);
  });
});

describe('listOccurrenceDates — YEARLY', () => {
  it('emette la ricorrenza anniversario una volta l’anno', () => {
    const rec: Rec = { frequency: 'YEARLY', dayOfMonth: null, startDate: new Date(2024, 5, 10), endDate: null, amount: 200 };
    const dates = listOccurrenceDates(rec, new Date(2026, 0, 1), new Date(2026, 11, 31));
    expect(dates.map(ymd)).toEqual([{ y: 2026, m: 5, d: 10 }]);
  });

  it('rispetta endDate della ricorrente', () => {
    const rec: Rec = { frequency: 'MONTHLY', dayOfMonth: 10, startDate: new Date(2026, 0, 1), endDate: new Date(2026, 1, 5), amount: 10 };
    const dates = listOccurrenceDates(rec, new Date(2026, 0, 1), new Date(2026, 5, 30));
    // Solo gennaio: la ricorrente termina il 5 feb, prima del 10 feb.
    expect(dates.map(ymd)).toEqual([{ y: 2026, m: 0, d: 10 }]);
  });
});

describe('countOccurrences = listOccurrenceDates(...).length', () => {
  it('coincide sempre col numero di date', () => {
    const rec: Rec = { frequency: 'MONTHLY', dayOfMonth: 20, startDate: new Date(2026, 0, 1), endDate: null, amount: 100 };
    const start = new Date(2026, 0, 1);
    const end = new Date(2026, 5, 30);
    expect(countOccurrences(rec, start, end)).toBe(listOccurrenceDates(rec, start, end).length);
  });
});

describe('buildProjectedPoints', () => {
  const start = new Date(2026, 6, 9); // 9 luglio
  const end = new Date(2026, 6, 12); // 12 luglio

  it('un punto per ogni giorno civile nel range, inclusi entrambi gli estremi', () => {
    const points = buildProjectedPoints(1000, [], start, end);
    expect(points.map((p) => p.date)).toEqual(['2026-07-09', '2026-07-10', '2026-07-11', '2026-07-12']);
  });

  it('nessun evento → retta piatta, saldo invariato', () => {
    const points = buildProjectedPoints(1000, [], start, end);
    expect(points.every((p) => p.balance === 1000)).toBe(true);
  });

  it('giorni senza eventi riportano in avanti l’ultimo saldo noto (forward-fill)', () => {
    const events: Ev[] = [{ date: new Date(2026, 6, 10), amount: 100, type: 'EXPENSE' }];
    const points = buildProjectedPoints(1000, events, start, end);
    // 9: invariato (oggi) — 10: -100 — 11/12: forward-fill di 10.
    expect(points.map((p) => p.balance)).toEqual([1000, 900, 900, 900]);
  });

  it('più eventi nello stesso giorno producono un solo punto aggregato, non due', () => {
    const events: Ev[] = [
      { date: new Date(2026, 6, 11), amount: 173.23, type: 'EXPENSE' },
      { date: new Date(2026, 6, 11), amount: 99.25, type: 'EXPENSE' },
    ];
    const points = buildProjectedPoints(875.92, events, start, end);
    const dates = points.map((p) => p.date);
    expect(dates.filter((d) => d === '2026-07-11')).toHaveLength(1);
    const day11 = points.find((p) => p.date === '2026-07-11')!;
    expect(day11.balance).toBeCloseTo(875.92 - 173.23 - 99.25, 2);
    // Il giorno successivo mantiene lo stesso saldo (nessun evento quel giorno).
    const day12 = points.find((p) => p.date === '2026-07-12')!;
    expect(day12.balance).toBeCloseTo(day11.balance, 2);
  });

  it('il punto di rangeStart resta sempre = currentBalance esatto, anche con eventi datati oggi', () => {
    const events: Ev[] = [{ date: start, amount: 50, type: 'INCOME' }];
    const points = buildProjectedPoints(1000, events, start, end);
    expect(points[0].balance).toBe(1000);
    // L'evento di oggi si riflette solo dal giorno successivo.
    expect(points[1].balance).toBe(1050);
  });

  it('numero di punti = numero di giorni nel range (inclusivo)', () => {
    const longEnd = new Date(2026, 7, 9); // 9 agosto: 1 mese dopo il 9 luglio
    const points = buildProjectedPoints(0, [], start, longEnd);
    const expectedDays = Math.round((longEnd.getTime() - start.getTime()) / 86400000) + 1;
    expect(points).toHaveLength(expectedDays);
  });
});
