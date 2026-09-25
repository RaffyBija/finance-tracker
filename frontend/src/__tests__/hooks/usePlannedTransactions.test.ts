import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useCreatePlanned,
  useUpdatePlanned,
  useDeletePlanned,
  useMarkAsPaid,
} from '../../hooks/usePlannedTransactions';
import { createTestQueryClient, createWrapper, createInvalidateSpy } from '../helpers';

vi.mock('../../api/planned', () => ({
  plannedApi: {
    getAll: vi.fn().mockResolvedValue([]),
    getDue: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({ id: '1' }),
    update: vi.fn().mockResolvedValue({ id: '1' }),
    delete: vi.fn().mockResolvedValue({}),
    markAsPaid: vi.fn().mockResolvedValue({ id: '1' }),
  },
}));

vi.mock('../../api/client', () => ({
  categoryAPI: { getAll: vi.fn().mockResolvedValue([]) },
}));

vi.mock('../../utils/syncChannel', () => ({ broadcastInvalidation: vi.fn() }));

const fakeDto = {
  amount: 50,
  type: 'EXPENSE' as const,
  description: 'Bolletta',
  categoryId: 'cat-1',
  plannedDate: '2026-06-01',
};

describe('useCreatePlanned', () => {
  it('invalida planned, dashboard, pending-planned e calendar', async () => {
    const qc = createTestQueryClient();
    const spy = createInvalidateSpy(qc);
    const { result } = renderHook(() => useCreatePlanned(), { wrapper: createWrapper(qc) });

    await act(async () => {
      await result.current.mutateAsync(fakeDto);
    });

    const keys = spy.mock.calls.map((c) => (c[0] as any)?.queryKey);
    expect(keys).toContainEqual(['planned']);
    expect(keys).toContainEqual(['dashboard']);
    expect(keys).toContainEqual(['pending-planned']);
    expect(keys).toContainEqual(['calendar']);
  });
});

describe('useUpdatePlanned', () => {
  it('invalida planned, dashboard, pending-planned e calendar', async () => {
    const qc = createTestQueryClient();
    const spy = createInvalidateSpy(qc);
    const { result } = renderHook(() => useUpdatePlanned(), { wrapper: createWrapper(qc) });

    await act(async () => {
      await result.current.mutateAsync({ id: 'p-1', data: { amount: 75 } });
    });

    const keys = spy.mock.calls.map((c) => (c[0] as any)?.queryKey);
    expect(keys).toContainEqual(['planned']);
    expect(keys).toContainEqual(['dashboard']);
    expect(keys).toContainEqual(['pending-planned']);
    expect(keys).toContainEqual(['calendar']);
  });
});

describe('useDeletePlanned', () => {
  it('invalida planned, dashboard, pending-planned e calendar', async () => {
    const qc = createTestQueryClient();
    const spy = createInvalidateSpy(qc);
    const { result } = renderHook(() => useDeletePlanned(), { wrapper: createWrapper(qc) });

    await act(async () => {
      await result.current.mutateAsync('p-1');
    });

    const keys = spy.mock.calls.map((c) => (c[0] as any)?.queryKey);
    expect(keys).toContainEqual(['planned']);
    expect(keys).toContainEqual(['dashboard']);
    expect(keys).toContainEqual(['pending-planned']);
    expect(keys).toContainEqual(['calendar']);
  });
});

describe('useMarkAsPaid', () => {
  it('invalida planned, transactions, dashboard, pending-planned, calendar e accounts', async () => {
    const qc = createTestQueryClient();
    const spy = createInvalidateSpy(qc);
    const { result } = renderHook(() => useMarkAsPaid(), { wrapper: createWrapper(qc) });

    await act(async () => {
      await result.current.mutateAsync('p-1');
    });

    const keys = spy.mock.calls.map((c) => (c[0] as any)?.queryKey);
    expect(keys).toContainEqual(['planned']);
    expect(keys).toContainEqual(['transactions']);
    expect(keys).toContainEqual(['dashboard']);
    expect(keys).toContainEqual(['pending-planned']);
    expect(keys).toContainEqual(['calendar']);
    expect(keys).toContainEqual(['accounts']);
  });
});
