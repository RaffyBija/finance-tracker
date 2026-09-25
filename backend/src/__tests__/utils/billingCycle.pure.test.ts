import { describe, it, expect } from 'vitest';
import {
  nextBillingDate,
  effectiveClosingDay,
  cycleWindowFor,
  currentCycleWindow,
  cycleLabel,
  debtContribution,
} from '../../utils/billingCycle';

// Helper: confronta una data sui suoi componenti locali (la logica dei cicli usa
// costruttori Date locali, quindi i confronti restano stabili a prescindere dal TZ).
function ymd(d: Date) {
  return { y: d.getFullYear(), m: d.getMonth(), d: d.getDate() };
}

describe('effectiveClosingDay — fallback closingDay ?? billingDay ?? 1', () => {
  it('usa closingDay quando presente', () => {
    expect(effectiveClosingDay({ closingDay: 20, billingDay: 5 })).toBe(20);
  });

  it('ricade su billingDay quando closingDay è null', () => {
    expect(effectiveClosingDay({ closingDay: null, billingDay: 5 })).toBe(5);
  });

  it('ricade su 1 quando entrambi sono null', () => {
    expect(effectiveClosingDay({ closingDay: null, billingDay: null })).toBe(1);
  });
});

describe('cycleWindowFor — appartenenza deterministica per closingDay', () => {
  const CLOSING = 15;

  it('una transazione PRIMA della chiusura sta nel ciclo che chiude questo mese', () => {
    const { periodStart, periodEnd } = cycleWindowFor(new Date(2026, 2, 10), CLOSING); // 10 mar
    expect(ymd(periodEnd)).toEqual({ y: 2026, m: 2, d: 15 });    // chiude 15 mar
    expect(ymd(periodStart)).toEqual({ y: 2026, m: 1, d: 16 });  // apre 16 feb
  });

  it('una transazione NEL giorno di chiusura appartiene al ciclo che chiude quel giorno (incluso)', () => {
    const { periodStart, periodEnd } = cycleWindowFor(new Date(2026, 2, 15), CLOSING); // 15 mar
    expect(ymd(periodEnd)).toEqual({ y: 2026, m: 2, d: 15 });
    expect(ymd(periodStart)).toEqual({ y: 2026, m: 1, d: 16 });
  });

  it('il giorno DOPO la chiusura cade nel ciclo successivo', () => {
    const { periodStart, periodEnd } = cycleWindowFor(new Date(2026, 2, 16), CLOSING); // 16 mar
    expect(ymd(periodEnd)).toEqual({ y: 2026, m: 3, d: 15 });    // chiude 15 apr
    expect(ymd(periodStart)).toEqual({ y: 2026, m: 2, d: 16 });  // apre 16 mar
  });

  it('gestisce il passaggio di anno', () => {
    const { periodStart, periodEnd } = cycleWindowFor(new Date(2026, 0, 10), CLOSING); // 10 gen 2026
    expect(ymd(periodEnd)).toEqual({ y: 2026, m: 0, d: 15 });    // chiude 15 gen 2026
    expect(ymd(periodStart)).toEqual({ y: 2025, m: 11, d: 16 }); // apre 16 dic 2025
  });

  it('clamping per closingDay 31 in un mese corto (febbraio)', () => {
    const { periodStart, periodEnd } = cycleWindowFor(new Date(2026, 1, 10), 31); // 10 feb
    expect(ymd(periodEnd)).toEqual({ y: 2026, m: 1, d: 28 });    // 2026 non bisestile → 28 feb
    expect(ymd(periodStart)).toEqual({ y: 2026, m: 1, d: 1 });   // apre 1 feb (dopo il 31 gen)
  });

  it('periodEnd è la fine del giorno (23:59:59.999) e periodStart l’inizio (00:00)', () => {
    const { periodStart, periodEnd } = cycleWindowFor(new Date(2026, 2, 10), CLOSING);
    expect(periodEnd.getHours()).toBe(23);
    expect(periodEnd.getMinutes()).toBe(59);
    expect(periodEnd.getMilliseconds()).toBe(999);
    expect(periodStart.getHours()).toBe(0);
    expect(periodStart.getMinutes()).toBe(0);
  });
});

describe('currentCycleWindow — delega a cycleWindowFor(now)', () => {
  it('coincide con cycleWindowFor per la stessa data', () => {
    const now = new Date(2026, 5, 3);
    const a = currentCycleWindow(15, now);
    const b = cycleWindowFor(now, 15);
    expect(a.periodStart.getTime()).toBe(b.periodStart.getTime());
    expect(a.periodEnd.getTime()).toBe(b.periodEnd.getTime());
  });
});

describe('nextBillingDate — prossimo addebito con clamping', () => {
  it('billingDay non ancora passato nel mese → stesso mese', () => {
    const d = nextBillingDate(15, new Date(2026, 2, 10)); // 10 mar
    expect(ymd(d)).toEqual({ y: 2026, m: 2, d: 15 });
  });

  it('billingDay già passato → mese successivo', () => {
    const d = nextBillingDate(15, new Date(2026, 2, 20)); // 20 mar
    expect(ymd(d)).toEqual({ y: 2026, m: 3, d: 15 });
  });

  it('billingDay 31 si clampa all’ultimo giorno di febbraio', () => {
    const d = nextBillingDate(31, new Date(2026, 1, 10)); // 10 feb
    expect(ymd(d)).toEqual({ y: 2026, m: 1, d: 28 });
  });

  it('quando from coincide col billingDay, restituisce quel giorno (non il mese dopo)', () => {
    const d = nextBillingDate(15, new Date(2026, 2, 15));
    expect(ymd(d)).toEqual({ y: 2026, m: 2, d: 15 });
  });
});

describe('debtContribution — segno del contributo al debito', () => {
  it('una spesa aumenta il debito (segno positivo)', () => {
    expect(debtContribution('EXPENSE', 100)).toBe(100);
  });

  it('un’entrata (rimborso) riduce il debito (segno negativo)', () => {
    expect(debtContribution('INCOME', 100)).toBe(-100);
  });
});

describe('cycleLabel — etichetta leggibile del ciclo', () => {
  it('include l’anno del giorno di chiusura', () => {
    expect(cycleLabel(new Date(2026, 2, 15))).toContain('2026');
  });
});
