import { describe, it, expect, vi, afterEach } from 'vitest';
import { scaleCaps, budgetPace, budgetStatus, toLocalDateString, planBudgets, budgetLeft, budgetFormChanged } from '../../utils/budget';
import type { Budget } from '../../types';

const base = { id: '1', name: 'b', amount: 100, period: 'MONTHLY', rollover: 'NONE' } as Budget;

afterEach(() => vi.useRealTimers());

describe('scaleCaps', () => {
  it('non tocca i tetti che stanno nello spendibile', () => {
    expect(scaleCaps([100, 50], 200)).toEqual({ caps: [100, 50], factor: 1, scaled: false });
  });
  it('scala in proporzione se la somma supera lo spendibile', () => {
    const r = scaleCaps([100, 100], 100);
    expect(r.scaled).toBe(true);
    expect(r.caps).toEqual([50, 50]);
    expect(r.factor).toBe(0.5);
  });
  it('arrotonda per difetto: la somma non supera mai lo spendibile', () => {
    const r = scaleCaps([10.01, 10.01, 10.01], 10);
    expect(r.caps.reduce((s, v) => s + v, 0)).toBeLessThanOrEqual(10);
  });
  it('spendibile <= 0 azzera i tetti', () => {
    expect(scaleCaps([100, 20], -5)).toEqual({ caps: [0, 0], factor: 0, scaled: true });
  });
});

describe('budgetPace', () => {
  it('tacca a metà periodo e proiezione al ritmo attuale', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-11T12:00:00Z')); // metà di una finestra 1..20 ott (20 giorni)
    const p = budgetPace({ ...base, spent: 50, periodStart: '2026-10-01T00:00:00Z', periodEnd: '2026-10-20T23:59:59.999Z' });
    expect(p.elapsed).toBeCloseTo(0.525, 2);
    expect(p.projected).toBeCloseTo(95.24, 1);
  });
  it('nessuna proiezione se il periodo è appena iniziato o senza spesa', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-01T06:00:00Z'));
    const w = { periodStart: '2026-10-01T00:00:00Z', periodEnd: '2026-10-31T00:00:00Z' };
    expect(budgetPace({ ...base, spent: 10, ...w }).projected).toBeNull();
    expect(budgetPace({ ...base, spent: 0, ...w }).projected).toBeNull();
  });
});

describe('budgetStatus / toLocalDateString', () => {
  it('usa lo status del backend, altrimenti deriva dalle date', () => {
    expect(budgetStatus({ ...base, status: 'expired', startDate: '2020-01-01' })).toBe('expired');
    expect(budgetStatus({ ...base, startDate: '2999-01-01' })).toBe('upcoming');
    expect(budgetStatus({ ...base, startDate: '2020-01-01', endDate: '2020-02-01' })).toBe('expired');
  });
  it('data locale senza scavalcare il giorno', () => {
    expect(toLocalDateString(new Date(2026, 9, 5, 0, 30))).toBe('2026-10-05');
  });
});

describe('planBudgets / budgetLeft', () => {
  const mk = (id: string, categoryId: string | undefined, over: Partial<Budget> = {}) =>
    ({ ...base, id, categoryId, status: 'active', period: 'PAY_PERIOD', ...over }) as Budget;

  it('esclude globale, altri periodi e budget non attivi', () => {
    const list = [
      mk('a', 'c1'),
      mk('glob', undefined),
      mk('w', 'c2', { period: 'WEEKLY' }),
      mk('f', 'c3', { status: 'upcoming' }),
    ];
    expect(planBudgets(list, 'PAY_PERIOD').map((b) => b.id)).toEqual(['a']);
  });
  it('se esiste il budget sulla macro, quello sulla sotto-categoria non si somma', () => {
    const macro = mk('trasporti', 'm1');
    const child = mk('carburante', 'c1', { category: { parentId: 'm1' } as Budget['category'] });
    expect(planBudgets([macro, child], 'PAY_PERIOD').map((b) => b.id)).toEqual(['trasporti']);
  });
  it('un budget sulla sotto-categoria resta se la macro non ha budget', () => {
    const child = mk('carburante', 'c1', { category: { parentId: 'm1' } as Budget['category'] });
    expect(planBudgets([child], 'PAY_PERIOD')).toHaveLength(1);
  });
  it('budgetLeft non va mai sotto zero', () => {
    expect(budgetLeft({ ...base, remaining: 40 } as Budget)).toBe(40);
    expect(budgetLeft({ ...base, remaining: -25 } as Budget)).toBe(0);
    expect(budgetLeft({ ...base, amount: 100, spent: 30 } as Budget)).toBe(70);
  });
});

describe('budgetFormChanged', () => {
  const saved = {
    ...base, name: 'Spesa', amount: 230, categoryId: 'c1', period: 'PAY_PERIOD',
    startDate: '2026-10-23T00:00:00.000Z', endDate: undefined,
  } as Budget;
  const same = { name: 'Spesa', amount: 230, categoryId: 'c1', period: 'PAY_PERIOD', rollover: 'NONE', startDate: '2026-10-23', endDate: '' };

  it('nessuna modifica: form identico al salvato', () => {
    expect(budgetFormChanged(same, saved)).toBe(false);
  });
  it('"Attivo da" svuotato non conta come modifica', () => {
    expect(budgetFormChanged({ ...same, startDate: '' }, saved)).toBe(false);
  });
  it('rileva importo, riporto, periodo, data di inizio e di fine cambiati', () => {
    expect(budgetFormChanged({ ...same, amount: 250 }, saved)).toBe(true);
    expect(budgetFormChanged({ ...same, rollover: 'SURPLUS' }, saved)).toBe(true);
    expect(budgetFormChanged({ ...same, period: 'MONTHLY' }, saved)).toBe(true);
    expect(budgetFormChanged({ ...same, startDate: '2026-10-01' }, saved)).toBe(true);
    expect(budgetFormChanged({ ...same, endDate: '2026-12-31' }, saved)).toBe(true);
  });
  it('ignora spazi attorno al nome', () => {
    expect(budgetFormChanged({ ...same, name: ' Spesa ' }, saved)).toBe(false);
  });
});
