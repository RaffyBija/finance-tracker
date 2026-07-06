import { createContext, useContext, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { recurringApi } from '../api/recurring';
import { plannedApi } from '../api/planned';
import { installmentsApi } from '../api/installments';
import type { RecurringDueResponse, PlannedTransaction, InstallmentDueRata } from '../types';

interface PendingContextValue {
  recurringDueCount: number;
  plannedDueCount: number;
  installmentDueCount: number;
  recurringDueData: RecurringDueResponse | undefined;
  plannedDueData: PlannedTransaction[];
  installmentDueData: InstallmentDueRata[];
  refresh: () => void;
}

const PendingContext = createContext<PendingContextValue>({
  recurringDueCount: 0,
  plannedDueCount: 0,
  installmentDueCount: 0,
  recurringDueData: undefined,
  plannedDueData: [],
  installmentDueData: [],
  refresh: () => {},
});

export function PendingProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const { data: recurringDueData } = useQuery<RecurringDueResponse>({
    queryKey: ['pending-recurring'],
    queryFn: recurringApi.getDue,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const { data: plannedDueData = [] } = useQuery<PlannedTransaction[]>({
    queryKey: ['pending-planned'],
    queryFn: plannedApi.getDue,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const { data: installmentDueData = [] } = useQuery<InstallmentDueRata[]>({
    queryKey: ['pending-installments'],
    queryFn: installmentsApi.getDue,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const recurringDueCount = recurringDueData
    ? recurringDueData.dueToday.length + recurringDueData.overdue.length
    : 0;

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['pending-recurring'] });
    queryClient.invalidateQueries({ queryKey: ['pending-planned'] });
    queryClient.invalidateQueries({ queryKey: ['pending-installments'] });
  };

  return (
    <PendingContext.Provider value={{
      recurringDueCount,
      plannedDueCount: plannedDueData.length,
      installmentDueCount: installmentDueData.length,
      recurringDueData,
      plannedDueData,
      installmentDueData,
      refresh,
    }}>
      {children}
    </PendingContext.Provider>
  );
}

export const usePending = () => useContext(PendingContext);
