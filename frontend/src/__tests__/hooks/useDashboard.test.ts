import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useQuery } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import {
  useSummary,
  useCategoryStats,
  useRecentTransactions,
  useProjectedBalance,
  useMonthlyTrend,
} from '../../hooks/useDashboard';
import { createTestQueryClient, createWrapper } from '../helpers';

// Wrap useQuery preservando l'implementazione reale ma rendendola ispezionabile
vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-query')>('@tanstack/react-query');
  return { ...actual, useQuery: vi.fn(actual.useQuery) };
});

vi.mock('../../api/client', () => ({
  dashboardAPI: {
    getSummary: vi.fn().mockResolvedValue({}),
    getCategoryStats: vi.fn().mockResolvedValue([]),
    getRecent: vi.fn().mockResolvedValue([]),
    getMonthlyTrend: vi.fn().mockResolvedValue([]),
    getProjectedBalance: vi.fn().mockResolvedValue({}),
  },
}));

const mockedUseQuery = vi.mocked(useQuery);

describe('useDashboard — refetchOnMount', () => {
  let wrapper: ReturnType<typeof createWrapper>;

  beforeEach(() => {
    mockedUseQuery.mockClear();
    wrapper = createWrapper(createTestQueryClient());
  });

  it('useSummary ha refetchOnMount: true', () => {
    renderHook(() => useSummary(), { wrapper });
    expect(mockedUseQuery).toHaveBeenCalledWith(
      expect.objectContaining({ refetchOnMount: true })
    );
  });

  it('useCategoryStats ha refetchOnMount: true', () => {
    renderHook(() => useCategoryStats(), { wrapper });
    expect(mockedUseQuery).toHaveBeenCalledWith(
      expect.objectContaining({ refetchOnMount: true })
    );
  });

  it('useRecentTransactions ha refetchOnMount: true', () => {
    renderHook(() => useRecentTransactions(), { wrapper });
    expect(mockedUseQuery).toHaveBeenCalledWith(
      expect.objectContaining({ refetchOnMount: true })
    );
  });

  it('useProjectedBalance ha refetchOnMount: true', () => {
    renderHook(() => useProjectedBalance({ months: 3 }), { wrapper });
    expect(mockedUseQuery).toHaveBeenCalledWith(
      expect.objectContaining({ refetchOnMount: true })
    );
  });

  it('useMonthlyTrend NON ha refetchOnMount: true (dati storici, ok cache)', () => {
    renderHook(() => useMonthlyTrend(), { wrapper });
    expect(mockedUseQuery).not.toHaveBeenCalledWith(
      expect.objectContaining({ refetchOnMount: true })
    );
  });
});
