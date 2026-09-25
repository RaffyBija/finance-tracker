import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useCreateTransaction,
  useUpdateTransaction,
  useDeleteTransaction,
} from '../../hooks/useTransactions';
import { createTestQueryClient, createWrapper, createInvalidateSpy } from '../helpers';

vi.mock('../../api/client', () => ({
  transactionAPI: {
    create: vi.fn().mockResolvedValue({ id: '1' }),
    update: vi.fn().mockResolvedValue({ id: '1' }),
    delete: vi.fn().mockResolvedValue({}),
    getAll: vi.fn().mockResolvedValue({ data: [], total: 0 }),
  },
  categoryAPI: {
    getAll: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../../utils/syncChannel', () => ({ broadcastInvalidation: vi.fn() }));

const fakeTransaction = {
  amount: 100,
  type: 'EXPENSE' as const,
  description: 'Test',
  categoryId: 'cat-1',
  date: '2026-05-27',
};

describe('useCreateTransaction', () => {
  it('invalida transactions, dashboard, budgets, calendar e accounts', async () => {
    const qc = createTestQueryClient();
    const spy = createInvalidateSpy(qc);
    const { result } = renderHook(() => useCreateTransaction(), { wrapper: createWrapper(qc) });

    await act(async () => { await result.current.mutateAsync(fakeTransaction); });

    const keys = spy.mock.calls.map((c) => (c[0] as any)?.queryKey);
    expect(keys).toContainEqual(['transactions']);
    expect(keys).toContainEqual(['dashboard']);
    expect(keys).toContainEqual(['budgets']);
    expect(keys).toContainEqual(['calendar']);
    expect(keys).toContainEqual(['accounts']);
  });
});

describe('useUpdateTransaction', () => {
  it('invalida transactions, dashboard, budgets, calendar e accounts', async () => {
    const qc = createTestQueryClient();
    const spy = createInvalidateSpy(qc);
    const { result } = renderHook(() => useUpdateTransaction(), { wrapper: createWrapper(qc) });

    await act(async () => { await result.current.mutateAsync({ id: '1', data: { amount: 200 } }); });

    const keys = spy.mock.calls.map((c) => (c[0] as any)?.queryKey);
    expect(keys).toContainEqual(['transactions']);
    expect(keys).toContainEqual(['dashboard']);
    expect(keys).toContainEqual(['budgets']);
    expect(keys).toContainEqual(['calendar']);
    expect(keys).toContainEqual(['accounts']);
  });
});

describe('useDeleteTransaction', () => {
  it('invalida transactions, dashboard, budgets, calendar e accounts', async () => {
    const qc = createTestQueryClient();
    const spy = createInvalidateSpy(qc);
    const { result } = renderHook(() => useDeleteTransaction(), { wrapper: createWrapper(qc) });

    await act(async () => { await result.current.mutateAsync('tx-1'); });

    const keys = spy.mock.calls.map((c) => (c[0] as any)?.queryKey);
    expect(keys).toContainEqual(['transactions']);
    expect(keys).toContainEqual(['dashboard']);
    expect(keys).toContainEqual(['budgets']);
    expect(keys).toContainEqual(['calendar']);
    expect(keys).toContainEqual(['accounts']);
  });
});
