import { describe, it, expect } from 'vitest';
import { buildDueEntries, groupInstallments, type DueEntry } from '../../components/due/dueEntries';

const TODAY = '2026-09-26';

const base = { amount: 10, type: 'EXPENSE' as const, isPaid: false, userId: 'u', createdAt: '', updatedAt: '' };

describe('buildDueEntries', () => {
  it('separa addebiti carta (ccAccountId) dalle pianificate normali', () => {
    const entries = buildDueEntries({
      recurring: undefined,
      planned: [
        { ...base, id: 'p1', description: 'Bolletta', plannedDate: '2026-09-26T00:00:00.000Z' },
        { ...base, id: 'p2', description: 'Addebito Visa', plannedDate: '2026-09-24T00:00:00.000Z',
          ccAccountId: 'cc1', accountId: 'b1' },
      ],
      installments: [],
      accounts: [{ id: 'b1', name: 'Intesa' } as any],
      today: TODAY,
    });
    expect(entries.map((e) => [e.key, e.kind])).toEqual([['p:p1', 'planned'], ['p:p2', 'cc']]);
    expect(entries[1].subtitle).toBe('Addebito su Intesa');
    expect(entries[0].daysOverdue).toBe(0);
    expect(entries[1].daysOverdue).toBe(2);
  });

  it('esclude i Sospesi (senza data) e include rate con il loro piano', () => {
    const entries = buildDueEntries({
      recurring: { dueToday: [], overdue: [] },
      planned: [{ ...base, id: 'p1', description: 'Sospeso', plannedDate: null }],
      installments: [{ ...base, id: 'i1', description: 'F24 — rata 1/5', plannedDate: '2026-09-20T00:00:00.000Z',
        planId: 'plan1', counterparty: 'Mario',
        plan: { id: 'plan1', title: 'F24', direction: 'DEBT', accountId: null } } as any],
      accounts: [],
      today: TODAY,
    });
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ key: 'i:i1', kind: 'installment', title: 'F24 — rata 1/5', planId: 'plan1', subtitle: 'Piano a rate · Mario' });
  });
});

describe('groupInstallments', () => {
  const rata = (id: string, planId: string): DueEntry => ({
    key: `i:${id}`, kind: 'installment', id, title: '', subtitle: '', amount: 1, type: 'EXPENSE',
    scheduledDate: '2026-09-20', daysOverdue: 6, planId,
  });

  it('una transazione per (piano, data)', () => {
    const dates: Record<string, string> = { 'i:c': '2026-09-25' };
    const groups = groupInstallments(
      [rata('a', 'P1'), rata('b', 'P1'), rata('c', 'P1'), rata('d', 'P2')],
      (e) => dates[e.key] ?? e.scheduledDate,
    );
    expect(groups).toEqual([
      { planId: 'P1', date: '2026-09-20', ids: ['a', 'b'] },
      { planId: 'P1', date: '2026-09-25', ids: ['c'] },
      { planId: 'P2', date: '2026-09-20', ids: ['d'] },
    ]);
  });
});
