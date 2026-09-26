import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useCreateRecurring,
  useUpdateRecurring,
  useDeleteRecurring,
  useToggleRecurring,
  useExecuteRecurring,
  useExecuteRecurringNow,
} from '../../hooks/useRecurringTransactions';
import { createTestQueryClient, createWrapper, createInvalidateSpy } from '../helpers';

vi.mock('../../api/recurring', () => ({
  recurringApi: {
    getAll: vi.fn().mockResolvedValue([]),
    getDue: vi.fn().mockResolvedValue({ dueToday: [], overdue: [] }),
    create: vi.fn().mockResolvedValue({ id: '1' }),
    update: vi.fn().mockResolvedValue({ id: '1' }),
    delete: vi.fn().mockResolvedValue({}),
    toggle: vi.fn().mockResolvedValue({ id: '1' }),
    execute: vi.fn().mockResolvedValue({}),
    executeNow: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock('../../api/client', () => ({
  categoryAPI: { getAll: vi.fn().mockResolvedValue([]) },
}));

vi.mock('../../utils/syncChannel', () => ({ broadcastInvalidation: vi.fn() }));

const fakeDto = {
  amount: 30,
  type: 'EXPENSE' as const,
  description: 'Netflix',
  categoryId: 'cat-1',
  frequency: 'MONTHLY' as const,
  startDate: '2026-01-01',
  dayOfMonth: 1,
};

function expectCalendarInvalidated(spy: ReturnType<typeof vi.spyOn>) {
  const keys = spy.mock.calls.map((c) => (c[0] as any)?.queryKey);
  expect(keys).toContainEqual(['calendar']);
}

describe('useCreateRecurring', () => {
  it('invalida recurring, dashboard, pending-recurring e calendar', async () => {
    const qc = createTestQueryClient();
    const spy = createInvalidateSpy(qc);
    const { result } = renderHook(() => useCreateRecurring(), { wrapper: createWrapper(qc) });

    await act(async () => { await result.current.mutateAsync(fakeDto); });

    const keys = spy.mock.calls.map((c) => (c[0] as any)?.queryKey);
    expect(keys).toContainEqual(['recurring']);
    expect(keys).toContainEqual(['dashboard']);
    expect(keys).toContainEqual(['pending-recurring']);
    expectCalendarInvalidated(spy);
  });
});

describe('useUpdateRecurring', () => {
  it('invalida recurring, dashboard, pending-recurring e calendar', async () => {
    const qc = createTestQueryClient();
    const spy = createInvalidateSpy(qc);
    const { result } = renderHook(() => useUpdateRecurring(), { wrapper: createWrapper(qc) });

    await act(async () => { await result.current.mutateAsync({ id: 'r-1', data: { amount: 50 } }); });

    expectCalendarInvalidated(spy);
  });
});

describe('useDeleteRecurring', () => {
  it('invalida recurring, dashboard, pending-recurring e calendar', async () => {
    const qc = createTestQueryClient();
    const spy = createInvalidateSpy(qc);
    const { result } = renderHook(() => useDeleteRecurring(), { wrapper: createWrapper(qc) });

    await act(async () => { await result.current.mutateAsync('r-1'); });

    expectCalendarInvalidated(spy);
  });
});

describe('useToggleRecurring', () => {
  it('invalida recurring, dashboard, pending-recurring e calendar', async () => {
    const qc = createTestQueryClient();
    const spy = createInvalidateSpy(qc);
    const { result } = renderHook(() => useToggleRecurring(), { wrapper: createWrapper(qc) });

    await act(async () => { await result.current.mutateAsync('r-1'); });

    expectCalendarInvalidated(spy);
  });
});

describe('useExecuteRecurring', () => {
  it('invalida transactions, dashboard, recurring, recurring-due, pending-recurring, calendar e accounts', async () => {
    const qc = createTestQueryClient();
    const spy = createInvalidateSpy(qc);
    const { result } = renderHook(() => useExecuteRecurring(), { wrapper: createWrapper(qc) });

    await act(async () => { await result.current.mutateAsync({ ids: ['r-1', 'r-2'] }); });

    const keys = spy.mock.calls.map((c) => (c[0] as any)?.queryKey);
    expect(keys).toContainEqual(['transactions']);
    expect(keys).toContainEqual(['dashboard']);
    expect(keys).toContainEqual(['recurring']);
    expect(keys).toContainEqual(['recurring-due']);
    expect(keys).toContainEqual(['pending-recurring']);
    expect(keys).toContainEqual(['calendar']);
    expect(keys).toContainEqual(['accounts']);
  });
});

describe('useExecuteRecurringNow', () => {
  it('invalida calendar tramite recurringInvalidations', async () => {
    const qc = createTestQueryClient();
    const spy = createInvalidateSpy(qc);
    const { result } = renderHook(() => useExecuteRecurringNow(), { wrapper: createWrapper(qc) });

    await act(async () => { await result.current.mutateAsync('r-1'); });

    expectCalendarInvalidated(spy);
  });
});
