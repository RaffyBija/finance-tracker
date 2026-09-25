import { describe, it, expect } from 'vitest';
import { isTransactionUnchanged } from '../../utils/transactionCompare';
import type { CreateTransactionDTO, Transaction } from '../../types';

const original: Transaction = {
  id: 'tx-1',
  amount: 50,
  type: 'EXPENSE',
  description: 'Spesa',
  date: '2026-09-20T00:00:00.000Z',
  categoryId: 'cat-1',
  accountId: 'acc-a',
  userId: 'u1',
  createdAt: '2026-09-20T00:00:00.000Z',
  updatedAt: '2026-09-20T00:00:00.000Z',
} as unknown as Transaction;

const formFromOriginal = (): CreateTransactionDTO => ({
  amount: original.amount,
  type: original.type,
  description: original.description,
  date: original.date.split('T')[0],
  categoryId: original.categoryId,
  accountId: original.accountId,
});

describe('isTransactionUnchanged', () => {
  it('true quando nessun campo del form differisce dall\'originale', () => {
    expect(isTransactionUnchanged(original, formFromOriginal(), false, false)).toBe(true);
  });

  it('false quando cambia solo l\'importo', () => {
    const form = { ...formFromOriginal(), amount: 75 };
    expect(isTransactionUnchanged(original, form, false, false)).toBe(false);
  });

  it('false quando cambia solo il tipo (entrata/uscita)', () => {
    const form = { ...formFromOriginal(), type: 'INCOME' as const };
    expect(isTransactionUnchanged(original, form, false, false)).toBe(false);
  });

  it('false quando cambia solo il conto associato (regressione bug saldo)', () => {
    const form = { ...formFromOriginal(), accountId: 'acc-b' };
    expect(isTransactionUnchanged(original, form, false, false)).toBe(false);
  });

  it('false quando cambia solo la data', () => {
    const form = { ...formFromOriginal(), date: '2026-09-21' };
    expect(isTransactionUnchanged(original, form, false, false)).toBe(false);
  });

  it('false quando cambiano conto e importo insieme', () => {
    const form = { ...formFromOriginal(), accountId: 'acc-b', amount: 99 };
    expect(isTransactionUnchanged(original, form, false, false)).toBe(false);
  });

  it('false quando era/è una transazione divisa, anche a parità di campi', () => {
    expect(isTransactionUnchanged(original, formFromOriginal(), true, false)).toBe(false);
    expect(isTransactionUnchanged(original, formFromOriginal(), false, true)).toBe(false);
  });
});
