import { describe, it, expect } from 'vitest';
import { resolvePayPeriod, clusterPaydays, serializePayPeriod, buildPayBoundaries, type PayPeriodInput } from '../../utils/payPeriod';

// now = 26 set 2026. Stipendio reale il 24 set, prossimo pianificato il 23 ott.
const NOW = new Date(2026, 8, 26, 10, 0, 0);
const d = (y: number, m: number, day: number) => new Date(y, m - 1, day);
const iso = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;

const base = (over: Partial<PayPeriodInput> = {}): PayPeriodInput => ({
  now: NOW,
  salaryConfigured: true,
  payDay: 23,
  salaryDates: [],
  plannedSalaryDates: [],
  recurringSalaryDates: [],
  ...over,
});

describe('clusterPaydays', () => {
  it('accorpa accrediti a pochi giorni di distanza tenendo il primo', () => {
    const out = clusterPaydays([d(2026, 9, 24), d(2026, 9, 23), d(2026, 8, 22)]);
    expect(out.map(iso)).toEqual(['2026-08-22', '2026-09-23']);
  });
});

describe('resolvePayPeriod', () => {
  it('prossimo accredito = pianificata della categoria, inizio = ultimo accredito reale', () => {
    const p = resolvePayPeriod(base({
      salaryDates: [d(2026, 7, 23), d(2026, 8, 24), d(2026, 9, 24)],
      plannedSalaryDates: [d(2026, 10, 23)],
    }));
    expect(p.source).toBe('planned');
    expect(iso(p.nextPayday)).toBe('2026-10-23');
    expect(iso(p.start)).toBe('2026-09-24');
    expect(p.completedPeriods.slice(-2).map((x) => [iso(x.start), iso(x.end)])).toEqual([
      ['2026-07-23', '2026-08-24'],
      ['2026-08-24', '2026-09-24'],
    ]);
    expect(p.completedPeriods).toHaveLength(3);
  });

  it('scarta una pianificata troppo vicina all\'ultimo accredito (stesso stipendio non segnato)', () => {
    const p = resolvePayPeriod(base({
      salaryDates: [d(2026, 9, 24)],
      plannedSalaryDates: [d(2026, 9, 27), d(2026, 10, 23)],
    }));
    expect(iso(p.nextPayday)).toBe('2026-10-23');
  });

  it('senza pianificate usa la ricorrente, poi il giorno di paga', () => {
    const rec = resolvePayPeriod(base({ recurringSalaryDates: [d(2026, 10, 27)] }));
    expect(rec.source).toBe('recurring');
    expect(iso(rec.nextPayday)).toBe('2026-10-27');
    // Nessun accredito passato: l'inizio è un mese prima del prossimo accredito noto
    // (non il payDay, che potrebbe non coincidere con la ricorrente).
    expect(iso(rec.start)).toBe('2026-09-26');

    const soon = resolvePayPeriod(base({ recurringSalaryDates: [d(2026, 9, 27)] }));
    expect(iso(soon.start)).toBe('2026-08-27');

    const pd = resolvePayPeriod(base());
    expect(pd.source).toBe('payday');
    expect(iso(pd.nextPayday)).toBe('2026-10-23');
    expect(iso(pd.start)).toBe('2026-09-23');
  });

  it('clampa il giorno di paga ai mesi corti', () => {
    const p = resolvePayPeriod(base({ now: new Date(2026, 1, 10), payDay: 31, salaryConfigured: false }));
    expect(iso(p.nextPayday)).toBe('2026-02-28');
    expect(iso(p.start)).toBe('2026-01-31');
  });

  it('senza configurazione ricade sul mese solare', () => {
    const p = resolvePayPeriod(base({ salaryConfigured: false, payDay: null }));
    expect(p.configured).toBe(false);
    expect(p.source).toBe('calendar');
    expect(iso(p.start)).toBe('2026-09-01');
    expect(iso(p.nextPayday)).toBe('2026-10-01');
    expect(p.completedPeriods.map((x) => iso(x.start))).toEqual(['2026-06-01', '2026-07-01', '2026-08-01']);
  });

  it('un buco nello storico interrompe la catena dei periodi reali', () => {
    // 23 apr → 24 set: nessun accredito in mezzo (periodo > 45 gg) → non è un periodo valido.
    const p = resolvePayPeriod(base({
      salaryDates: [d(2026, 3, 23), d(2026, 4, 23), d(2026, 9, 24)],
      plannedSalaryDates: [d(2026, 10, 23)],
    }));
    // Nessun periodo reale contiguo a 24 set: completati a ritroso col giorno di paga.
    expect(p.completedPeriods.map((x) => [iso(x.start), iso(x.end)])).toEqual([
      ['2026-06-23', '2026-07-23'],
      ['2026-07-23', '2026-08-23'],
      ['2026-08-23', '2026-09-24'],
    ]);
  });

  it('serializza giorni trascorsi, totali e mancanti', () => {
    const p = resolvePayPeriod(base({ salaryDates: [d(2026, 9, 24)], plannedSalaryDates: [d(2026, 10, 23)] }));
    const s = serializePayPeriod(p, NOW);
    expect(s).toMatchObject({ start: '2026-09-24', nextPayday: '2026-10-23', daysElapsed: 3, daysTotal: 29, daysToPayday: 27 });
  });
});

describe('buildPayBoundaries', () => {
  it('accrediti reali + prossimo, estesi a ritroso e in avanti col giorno di paga', () => {
    const b = buildPayBoundaries({
      paydays: [d(2026, 8, 24), d(2026, 9, 24)],
      nextPayday: d(2026, 10, 23),
      payDay: 23,
      from: d(2026, 7, 1),
      to: d(2026, 11, 1),
    });
    expect(b.map(iso)).toEqual(['2026-06-23', '2026-07-23', '2026-08-24', '2026-09-24', '2026-10-23', '2026-11-23']);
  });

  it('riempie un buco nello storico con periodi mensili', () => {
    const b = buildPayBoundaries({
      paydays: [d(2026, 3, 23), d(2026, 7, 23)],
      nextPayday: d(2026, 8, 23),
      payDay: 23,
      from: d(2026, 3, 23),
      to: d(2026, 8, 1),
    });
    expect(b.map(iso)).toEqual(['2026-03-23', '2026-04-23', '2026-05-23', '2026-06-23', '2026-07-23', '2026-08-23']);
  });

  it('senza giorno di paga avanza di un mese dallo stesso giorno', () => {
    const b = buildPayBoundaries({ paydays: [], nextPayday: d(2026, 10, 27), payDay: null, from: d(2026, 9, 1), to: d(2026, 10, 30) });
    expect(b.map(iso)).toEqual(['2026-08-27', '2026-09-27', '2026-10-27', '2026-11-27']);
  });
});
