import { useQuery } from '@tanstack/react-query';
import { dashboardAPI } from '../api/client';

export const useSummary = () => {
  return useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: () => dashboardAPI.getSummary(),
    staleTime: 2 * 60 * 1000, // 2 minuti
  });
};

export const useCategoryStats = () => {
  return useQuery({
    queryKey: ['dashboard', 'category-stats'],
    queryFn: () => dashboardAPI.getCategoryStats(),
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

export const useProjectedBalance = (months: number = 3) => {
  return useQuery({
    queryKey: ['dashboard', 'projected-balance', months],
    queryFn: () => dashboardAPI.getProjectedBalance(months),
    staleTime: 2 * 60 * 1000,
  });
};