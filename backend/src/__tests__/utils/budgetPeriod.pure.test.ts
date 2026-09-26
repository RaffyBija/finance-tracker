import { describe, it, expect } from 'vitest';
import {
  budgetWindowFor,
  currentBudgetWindow,
  recentBudgetWindows,
  budgetWindowLabel,
} from '../../utils/budgetPeriod';

// Confronta una data sui suoi componenti locali (le finestre usano costruttori
// Date locali, quindi i confronti restano stabili a prescindere dal TZ).
function ymd(d: Date) {
  return { y: d.getFullYear(), m: d.getMonth(), d: d.getDate() };
}
function hms(d: Date) {
  return { h: d.getHours(), mi: d.getMinutes(), s: d.getSeconds(), ms: d.getMilliseconds() };
}

describe('budgetWindowFor — MONTHLY', () => {
  it('finestra = mese solare che contiene la data', () => {
    const { periodStart, periodEnd } = budgetWindowFor(new Date(2026, 6, 15), 'MONTHLY'); // 15 lug
    expect(ymd(periodStart)).toEqual({ y: 2026, m: 6, d: 1 });
    expect(ymd(periodEnd)).toEqual({ y: 2026, m: 6, d: 31 });
    expect(hms(periodStart)).toEqual({ h: 0, mi: 0, s: 0, ms: 0 });
    expect(hms(periodEnd)).toEqual({ h: 23, mi: 59, s: 59, ms: 999 });
  });

  it('febbraio bisestile chiude il 29', () => {
    const { periodEnd } = budgetWindowFor(new Date(2028, 1, 10), 'MONTHLY'); // 2028 bisestile
    expect(ymd(periodEnd)).toEqual({ y: 2028, m: 1, d: 29 });
  });

  it('febbraio non bisestile chiude il 28', () => {
    const { periodEnd } = budgetWindowFor(new Date(2026, 1, 10), 'MONTHLY');
    expect(ymd(periodEnd)).toEqual({ y: 2026, m: 1, d: 28 });
  });

  it('il primo del mese appartiene al mese stesso', () => {
    const { periodStart, periodEnd } = budgetWindowFor(new Date(2026, 6, 1), 'MONTHLY');
    expect(ymd(periodStart)).toEqual({ y: 2026, m: 6, d: 1 });
    expect(ymd(periodEnd)).toEqual({ y: 2026, m: 6, d: 31 });
  });
});

describe('budgetWindowFor — YEARLY', () => {
  it('finestra = anno solare', () => {
    const { periodStart, periodEnd } = budgetWindowFor(new Date(2026, 6, 15), 'YEARLY');
    expect(ymd(periodStart)).toEqual({ y: 2026, m: 0, d: 1 });
    expect(ymd(periodEnd)).toEqual({ y: 2026, m: 11, d: 31 });
  });
});

describe('budgetWindowFor — WEEKLY (lun→dom)', () => {
  it('mercoledì → settimana lun-dom che lo contiene', () => {
    // 2026-07-15 è un mercoledì
    const { periodStart, periodEnd } = budgetWindowFor(new Date(2026, 6, 15), 'WEEKLY');
    expect(ymd(periodStart)).toEqual({ y: 2026, m: 6, d: 13 }); // lunedì 13
    expect(ymd(periodEnd)).toEqual({ y: 2026, m: 6, d: 19 }); // domenica 19
  });

  it('domenica appartiene alla settimana che si chiude quel giorno', () => {
    // 2026-07-19 è domenica
    const { periodStart, periodEnd } = budgetWindowFor(new Date(2026, 6, 19), 'WEEKLY');
    expect(ymd(periodStart)).toEqual({ y: 2026, m: 6, d: 13 });
    expect(ymd(periodEnd)).toEqual({ y: 2026, m: 6, d: 19 });
  });

  it('lunedì apre una nuova settimana', () => {
    // 2026-07-13 è lunedì
    const { periodStart } = budgetWindowFor(new Date(2026, 6, 13), 'WEEKLY');
    expect(ymd(periodStart)).toEqual({ y: 2026, m: 6, d: 13 });
  });
});

describe('currentBudgetWindow', () => {
  it('delega a budgetWindowFor con now', () => {
    const now = new Date(2026, 6, 10);
    const a = currentBudgetWindow('MONTHLY', now);
    const b = budgetWindowFor(now, 'MONTHLY');
    expect(a.periodStart.getTime()).toBe(b.periodStart.getTime());
    expect(a.periodEnd.getTime()).toBe(b.periodEnd.getTime());
  });
});

describe('recentBudgetWindows — N finestre in ordine cronologico', () => {
  it('MONTHLY: ritorna i mesi precedenti fino alla corrente', () => {
    const ws = recentBudgetWindows('MONTHLY', 3, new Date(2026, 6, 10)); // luglio
    expect(ws).toHaveLength(3);
    expect(ymd(ws[0].periodStart)).toEqual({ y: 2026, m: 4, d: 1 }); // maggio
    expect(ymd(ws[1].periodStart)).toEqual({ y: 2026, m: 5, d: 1 }); // giugno
    expect(ymd(ws[2].periodStart)).toEqual({ y: 2026, m: 6, d: 1 }); // luglio (corrente)
  });

  it('attraversa il confine di anno', () => {
    const ws = recentBudgetWindows('MONTHLY', 2, new Date(2026, 0, 15)); // gennaio 2026
    expect(ymd(ws[0].periodStart)).toEqual({ y: 2025, m: 11, d: 1 }); // dicembre 2025
    expect(ymd(ws[1].periodStart)).toEqual({ y: 2026, m: 0, d: 1 }); // gennaio 2026
  });

  it('WEEKLY: settimane consecutive non sovrapposte', () => {
    const ws = recentBudgetWindows('WEEKLY', 2, new Date(2026, 6, 15));
    expect(ymd(ws[0].periodStart)).toEqual({ y: 2026, m: 6, d: 6 }); // lun precedente
    expect(ymd(ws[1].periodStart)).toEqual({ y: 2026, m: 6, d: 13 }); // lun corrente
  });
});

describe('budgetWindowLabel', () => {
  it('MONTHLY → "mese anno"', () => {
    const w = budgetWindowFor(new Date(2026, 6, 10), 'MONTHLY');
    expect(budgetWindowLabel(w, 'MONTHLY')).toBe('luglio 2026');
  });

  it('YEARLY → "anno"', () => {
    const w = budgetWindowFor(new Date(2026, 6, 10), 'YEARLY');
    expect(budgetWindowLabel(w, 'YEARLY')).toBe('2026');
  });

  it('WEEKLY → "g–g mese anno"', () => {
    const w = budgetWindowFor(new Date(2026, 6, 15), 'WEEKLY');
    expect(budgetWindowLabel(w, 'WEEKLY')).toBe('13–19 lug 2026');
  });
});

describe('PAY_PERIOD', () => {
  const B = [new Date(2026, 7, 24), new Date(2026, 8, 24), new Date(2026, 9, 23), new Date(2026, 10, 23)];

  it('finestra tra due accrediti (fine = giorno prima del successivo)', () => {
    const w = budgetWindowFor(new Date(2026, 9, 1, 15), 'PAY_PERIOD', B);
    expect(w.periodStart).toEqual(new Date(2026, 8, 24, 0, 0, 0, 0));
    expect(w.periodEnd).toEqual(new Date(2026, 9, 22, 23, 59, 59, 999));
    expect(budgetWindowLabel(w, 'PAY_PERIOD')).toBe('24 set – 22 ott 2026');
  });

  it('il giorno dell\'accredito apre il periodo nuovo', () => {
    const w = budgetWindowFor(new Date(2026, 9, 23, 8), 'PAY_PERIOD', B);
    expect(w.periodStart).toEqual(new Date(2026, 9, 23, 0, 0, 0, 0));
  });

  it('finestre recenti in ordine cronologico', () => {
    const ws = recentBudgetWindows('PAY_PERIOD', 2, new Date(2026, 9, 1), B);
    expect(ws.map((w) => w.periodStart.getDate())).toEqual([24, 24]);
    expect(ws[0].periodStart.getMonth()).toBe(7);
  });

  it('senza confini (periodo di paga non impostato) si comporta come MONTHLY', () => {
    const w = budgetWindowFor(new Date(2026, 9, 10), 'PAY_PERIOD', null);
    expect(w).toEqual(budgetWindowFor(new Date(2026, 9, 10), 'MONTHLY'));
    expect(budgetWindowLabel(w, 'PAY_PERIOD')).toBe('ottobre 2026');
  });
});
