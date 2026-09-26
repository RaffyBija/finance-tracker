import { useQuery } from '@tanstack/react-query';
import { analyticsAPI } from '../api/analytics';

// Chiavi sotto ['dashboard'] così le mutation che già invalidano la dashboard
// (transazioni, ricorrenti, pianificate, rate) aggiornano anche stima e periodo.
// Dati dashboard → staleTime 0 + refetchOnMount (override del default globale).
export const useForecast = () => {
  return useQuery({
    queryKey: ['dashboard', 'forecast'],
    queryFn: analyticsAPI.getForecast,
    staleTime: 0,
    refetchOnMount: true,
  });
};

export const usePayPeriod = (enabled = true) => {
  return useQuery({
    queryKey: ['dashboard', 'pay-period'],
    queryFn: analyticsAPI.getPayPeriod,
    staleTime: 0,
    refetchOnMount: true,
    enabled,
  });
};

export const useSpendingAnalysis = (periods: number, mode: 'pay' | 'month') => {
  return useQuery({
    queryKey: ['dashboard', 'spending', mode, periods],
    queryFn: () => analyticsAPI.getSpending({ periods, mode }),
    staleTime: 0,
    refetchOnMount: true,
    placeholderData: (prev) => prev, // niente sfarfallio cambiando orizzonte/modalità
  });
};

export const useNetWorthNow = () => {
  return useQuery({
    queryKey: ['dashboard', 'net-worth-now'],
    queryFn: analyticsAPI.getNetWorthNow,
    staleTime: 0,
    refetchOnMount: true,
  });
};

