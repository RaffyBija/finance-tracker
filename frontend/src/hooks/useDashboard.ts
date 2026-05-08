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

export const useSummary = (dateRange?: DateRange) => {
  return useQuery({
    queryKey: ['dashboard', 'summary', dateRange],
    queryFn: () => dashboardAPI.getSummary(dateRange),
    staleTime: 2 * 60 * 1000,
  });
};

export const useCategoryStats = (dateRange?: DateRange) => {
  return useQuery({
    queryKey: ['dashboard', 'category-stats', dateRange],
    queryFn: () => dashboardAPI.getCategoryStats(dateRange),
    staleTime: 2 * 60 * 1000,
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
    staleTime: 1 * 60 * 1000,
  });
};

export const useProjectedBalance = (params: ProjectedBalanceParams, enabled = true) => {
  return useQuery({
    queryKey: ['dashboard', 'projected-balance', params],
    queryFn: () => dashboardAPI.getProjectedBalance(params),
    staleTime: 2 * 60 * 1000,
    enabled,
  });
};