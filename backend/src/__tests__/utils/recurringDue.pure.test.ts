import { describe, it, expect } from 'vitest';
import { computeNextDueDate, computeMissedDueDates } from '../../controllers/recurring.controller';

const monthly = (lastExecutedDate: Date | null) => ({
  frequency: 'MONTHLY',
  dayOfMonth: 5,
  startDate: new Date(2026, 0, 5),
  endDate: null,
  lastExecutedDate,
});

describe('computeMissedDueDates', () => {
  const today = new Date(2026, 8, 30);
  const latest = computeNextDueDate(monthly(null), today)!; // 5 set

  it('recupera le occorrenze tra ultima esecuzione e scadenza corrente', () => {
    const missed = computeMissedDueDates(monthly(new Date(2026, 5, 5)), latest);
    expect(missed.map((d) => d.getMonth())).toEqual([6, 7]); // lug, ago
  });

  it('nessuna arretrata se già in pari', () => {
    expect(computeMissedDueDates(monthly(new Date(2026, 7, 5)), latest)).toEqual([]);
  });

  it('senza lastExecutedDate non genera storico retroattivo', () => {
    expect(computeMissedDueDates(monthly(null), latest)).toEqual([]);
  });

  it('rispetta endDate', () => {
    const r = { ...monthly(new Date(2026, 3, 5)), endDate: new Date(2026, 5, 30) };
    expect(computeMissedDueDates(r, latest).map((d) => d.getMonth())).toEqual([4, 5]);
  });
});
