import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useCreateAccount,
  useUpdateAccount,
  useDeleteAccount,
  useSetDefaultAccount,
  useCloseBillingCycle,
} from '../../hooks/useAccounts';
import { createTestQueryClient, createWrapper, createInvalidateSpy } from '../helpers';

vi.mock('../../api/accounts', () => ({
  accountsAPI: {
    getAll:             vi.fn().mockResolvedValue([]),
    create:             vi.fn().mockResolvedValue({ id: 'acc-1' }),
    update:             vi.fn().mockResolvedValue({ id: 'acc-1' }),
    delete:             vi.fn().mockResolvedValue({}),
    setDefault:         vi.fn().mockResolvedValue({}),
    closeBillingCycle:  vi.fn().mockResolvedValue({ cycled: true, debtAmount: 100 }),
  },
}));

vi.mock('../../utils/syncChannel', () => ({
  broadcastInvalidation: vi.fn(),
}));

const fakeAccount = {
  name: 'Conto Test',
  type: 'BANK' as const,
  color: '#0d9488',
};

describe('useCreateAccount', () => {
  it('invalida accounts', async () => {
    const qc = createTestQueryClient();
    const spy = createInvalidateSpy(qc);
    const { result } = renderHook(() => useCreateAccount(), { wrapper: createWrapper(qc) });

    await act(async () => { await result.current.mutateAsync(fakeAccount); });

    const keys = spy.mock.calls.map((c) => (c[0] as any)?.queryKey);
    expect(keys).toContainEqual(['accounts']);
  });
});

describe('useUpdateAccount', () => {
  it('invalida accounts', async () => {
    const qc = createTestQueryClient();
    const spy = createInvalidateSpy(qc);
    const { result } = renderHook(() => useUpdateAccount(), { wrapper: createWrapper(qc) });

    await act(async () => { await result.current.mutateAsync({ id: 'acc-1', data: { name: 'Nuovo nome' } }); });

    const keys = spy.mock.calls.map((c) => (c[0] as any)?.queryKey);
    expect(keys).toContainEqual(['accounts']);
  });
});

describe('useDeleteAccount', () => {
  it('invalida accounts, transactions, dashboard, planned, recurring e calendar', async () => {
    const qc = createTestQueryClient();
    const spy = createInvalidateSpy(qc);
    const { result } = renderHook(() => useDeleteAccount(), { wrapper: createWrapper(qc) });

    await act(async () => { await result.current.mutateAsync('acc-1'); });

    const keys = spy.mock.calls.map((c) => (c[0] as any)?.queryKey);
    expect(keys).toContainEqual(['accounts']);
    expect(keys).toContainEqual(['transactions']);
    expect(keys).toContainEqual(['dashboard']);
    expect(keys).toContainEqual(['planned']);
    expect(keys).toContainEqual(['recurring']);
    expect(keys).toContainEqual(['calendar']);
  });
});

describe('useSetDefaultAccount', () => {
  it('invalida accounts', async () => {
    const qc = createTestQueryClient();
    const spy = createInvalidateSpy(qc);
    const { result } = renderHook(() => useSetDefaultAccount(), { wrapper: createWrapper(qc) });

    await act(async () => { await result.current.mutateAsync('acc-1'); });

    const keys = spy.mock.calls.map((c) => (c[0] as any)?.queryKey);
    expect(keys).toContainEqual(['accounts']);
  });
});

describe('useCloseBillingCycle', () => {
  it('invalida accounts, planned, calendar, pending-planned e dashboard', async () => {
    const qc = createTestQueryClient();
    const spy = createInvalidateSpy(qc);
    const { result } = renderHook(() => useCloseBillingCycle(), { wrapper: createWrapper(qc) });

    await act(async () => { await result.current.mutateAsync('acc-cc-1'); });

    const keys = spy.mock.calls.map((c) => (c[0] as any)?.queryKey);
    expect(keys).toContainEqual(['accounts']);
    expect(keys).toContainEqual(['planned']);
    expect(keys).toContainEqual(['calendar']);
    expect(keys).toContainEqual(['pending-planned']);
    expect(keys).toContainEqual(['dashboard']);
  });
});
