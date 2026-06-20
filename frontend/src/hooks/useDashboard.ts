import { useQuery } from '@tanstack/react-query';
import { dashboardAPI } from '../api/client';

interface DateRange {
  startDate: string;
  endDate: string;
}

interface ProjectedBalanceParams {
  months?: number;
  startDate?: string;
  endDate?: string;
  accountId?: string;
}

interface ProjectionSeriesParams {
  months?: number;
  startDate?: string;
  endDate?: string;
  accountId?: string;
  historyDays?: number;
}

// staleTime: 0 + refetchOnMount: true → refetch garantito ad ogni mount (override del default globale false)
// il trend mensile è dati storici stabili, può restare cacheato più a lungo
export const useSummary = (dateRange?: DateRange) => {
  return useQuery({
    queryKey: ['dashboard', 'summary', dateRange],
    queryFn: () => dashboardAPI.getSummary(dateRange),
    staleTime: 0,
    refetchOnMount: true,
  });
};

export const useCategoryStats = (dateRange?: DateRange) => {
  return useQuery({
    queryKey: ['dashboard', 'category-stats', dateRange],
    queryFn: () => dashboardAPI.getCategoryStats(dateRange),
    staleTime: 0,
    refetchOnMount: true,
  });
};

export const useMonthlyTrend = (months: number = 6) => {
  return useQuery({
    queryKey: ['dashboard', 'monthly-trend', months],
    queryFn: () => dashboardAPI.getMonthlyTrend(months),
    staleTime: 5 * 60 * 1000,
  });
};

export const useRecentTransactions = (limit: number = 5) => {
  return useQuery({
    queryKey: ['dashboard', 'recent', limit],
    queryFn: () => dashboardAPI.getRecent(limit),
    staleTime: 0,
    refetchOnMount: true,
  });
};

export const useProjectedBalance = (params: ProjectedBalanceParams, enabled = true) => {
  return useQuery({
    queryKey: ['dashboard', 'projected-balance', params],
    queryFn: () => dashboardAPI.getProjectedBalance(params),
    staleTime: 0,
    refetchOnMount: true,
    enabled,
  });
};

export const useProjectionSeries = (params: ProjectionSeriesParams, enabled = true) => {
  return useQuery({
    queryKey: ['dashboard', 'projection-series', params],
    queryFn: () => dashboardAPI.getProjectionSeries(params),
    staleTime: 0,
    refetchOnMount: true,
    enabled,
  });
};

// Andamento storico del patrimonio netto: dati storici stabili → cache 5 min.
export const useNetWorthSeries = (months: number = 12) => {
  return useQuery({
    queryKey: ['dashboard', 'networth-series', months],
    queryFn: () => dashboardAPI.getNetWorthSeries({ months }),
    staleTime: 5 * 60 * 1000,
  });
};

// Andamento del patrimonio scomposto per conto (stacked area). Caricato solo
// quando la vista "scomponi per conto" è attiva (enabled).
export const useNetWorthByAccount = (months: number = 12, enabled = true) => {
  return useQuery({
    queryKey: ['dashboard', 'networth-by-account', months],
    queryFn: () => dashboardAPI.getNetWorthByAccount({ months }),
    staleTime: 5 * 60 * 1000,
    enabled,
  });
};

// Trend per categoria nel tempo (default EXPENSE): dati storici → cache 5 min.
export const useCategoryTrend = (months: number = 12, type: 'INCOME' | 'EXPENSE' = 'EXPENSE') => {
  return useQuery({
    queryKey: ['dashboard', 'category-trend', months, type],
    queryFn: () => dashboardAPI.getCategoryTrend({ months, type }),
    staleTime: 5 * 60 * 1000,
  });
};
