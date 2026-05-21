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
}

// staleTime: 0 → dati considerati stale immediatamente → refetch garantito ad ogni mount
// il trend mensile è dati storici stabili, può restare cacheato più a lungo
export const useSummary = (dateRange?: DateRange) => {
  return useQuery({
    queryKey: ['dashboard', 'summary', dateRange],
    queryFn: () => dashboardAPI.getSummary(dateRange),
    staleTime: 0,
  });
};

export const useCategoryStats = (dateRange?: DateRange) => {
  return useQuery({
    queryKey: ['dashboard', 'category-stats', dateRange],
    queryFn: () => dashboardAPI.getCategoryStats(dateRange),
    staleTime: 0,
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
  });
};

export const useProjectedBalance = (params: ProjectedBalanceParams, enabled = true) => {
  return useQuery({
    queryKey: ['dashboard', 'projected-balance', params],
    queryFn: () => dashboardAPI.getProjectedBalance(params),
    staleTime: 0,
    enabled,
  });
};
