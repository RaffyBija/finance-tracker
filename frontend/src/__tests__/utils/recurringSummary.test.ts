import { describe, it, expect } from 'vitest';
import { summarizeRecurring, type RecurringSummaryItem } from '../../utils/recurringSummary';

const r = (o: Partial<RecurringSummaryItem>): RecurringSummaryItem => ({
  amount: 100, type: 'EXPENSE', frequency: 'MONTHLY', isActive: true, ...o,
});

describe('summarizeRecurring', () => {
  it('lista vuota: tutto a zero', () => {
    expect(summarizeRecurring([])).toEqual({ income: 0, expense: 0, net: 0, netYearly: 0, count: 0 });
  });

  it('normalizza le frequenze a mensile', () => {
    const s = summarizeRecurring([
      r({ amount: 10, frequency: 'MONTHLY' }),
      r({ amount: 12, frequency: 'WEEKLY' }), // 12 × 52/12 = 52
      r({ amount: 120, frequency: 'YEARLY' }), // 10
    ]);
    expect(s.expense).toBe(72);
    expect(s.count).toBe(3);
  });

  it('esclude le disattivate', () => {
    const s = summarizeRecurring([r({ amount: 50 }), r({ amount: 999, isActive: false })]);
    expect(s.expense).toBe(50);
    expect(s.count).toBe(1);
  });

  it('solo entrate: netto positivo', () => {
    const s = summarizeRecurring([r({ type: 'INCOME', amount: 1700 })]);
    expect(s).toMatchObject({ income: 1700, expense: 0, net: 1700, netYearly: 20400 });
  });

  it('solo uscite: netto negativo', () => {
    const s = summarizeRecurring([r({ amount: 99.25 })]);
    expect(s).toMatchObject({ income: 0, expense: 99.25, net: -99.25, netYearly: -1191 });
  });

  it('entrate e uscite miste', () => {
    const s = summarizeRecurring([
      r({ type: 'INCOME', amount: 1700 }),
      r({ amount: 99.25 }),
      r({ amount: 600, frequency: 'YEARLY' }),
    ]);
    expect(s.net).toBe(1550.75);
  });

  it('decimali senza errori float evidenti', () => {
    const s = summarizeRecurring([r({ amount: 0.1 }), r({ amount: 0.2 })]);
    expect(s.expense).toBe(0.3);
    expect(summarizeRecurring([r({ amount: '19.99', frequency: 'WEEKLY' })]).expense).toBe(86.62);
  });
});
