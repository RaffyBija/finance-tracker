import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { recurringApi } from '../api/recurring';
import { useDailyGate } from './useDailyGate';
import { categoryAPI } from '../api/client';
import { broadcastInvalidation } from '../utils/syncChannel';
import type { CreateRecurringTransactionDTO, RecurringDueResponse } from '../types';

const RECURRING_EXECUTE_KEYS = ['transactions', 'dashboard', 'recurring', 'recurring-due', 'pending-recurring', 'calendar', 'accounts'];
const RECURRING_CRUD_KEYS    = ['recurring', 'dashboard', 'pending-recurring', 'calendar'];

const DUE_CHECK_KEY = 'recurringDueCheck';

export function useRecurringDue() {
  const { isDismissed, dismiss } = useDailyGate(DUE_CHECK_KEY);

  const { data, isError } = useQuery<RecurringDueResponse>({
    queryKey: ['recurring-due'],
    queryFn: recurringApi.getDue,
    enabled: !isDismissed,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  // Derivato, non impostato da un effect: un refetch dopo "Salta oggi" non
  // può riaprire il popup, perché il gate giornaliero ha la precedenza.
  const total = data ? data.dueToday.length + data.overdue.length : 0;
  const isOpen = !isDismissed && total > 0;

  return { data: data ?? null, isOpen, dismiss, isError };
}

const recurringInvalidations = (queryClient: ReturnType<typeof useQueryClient>) => {
  RECURRING_EXECUTE_KEYS.forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
  broadcastInvalidation(RECURRING_EXECUTE_KEYS);
};

export function useExecuteRecurring() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => recurringApi.execute(ids),
    onSuccess: () => recurringInvalidations(queryClient),
  });
}

export function useExecuteRecurringNow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => recurringApi.executeNow(id),
    onSuccess: () => recurringInvalidations(queryClient),
  });
}

export function useRecurringTransactions() {
  const { data: recurring = [], isLoading: recurringLoading } = useQuery({
    queryKey: ['recurring'],
    queryFn: () => recurringApi.getAll(),
    staleTime: 3 * 60 * 1000,
  });

  const { data: categories = [], isLoading: categoriesLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoryAPI.getAll(),
    staleTime: 10 * 60 * 1000,
  });

  return {
    recurring,
    categories,
    isLoading: recurringLoading,
    categoriesLoading,
  };
}

const recurringCrudInvalidations = (queryClient: ReturnType<typeof useQueryClient>) => {
  RECURRING_CRUD_KEYS.forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
  broadcastInvalidation(RECURRING_CRUD_KEYS);
};

export function useDeleteRecurring() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => recurringApi.delete(id),
    onSuccess: () => recurringCrudInvalidations(queryClient),
  });
}

export function useToggleRecurring() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => recurringApi.toggle(id),
    onSuccess: () => recurringCrudInvalidations(queryClient),
  });
}

export function useCreateRecurring() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateRecurringTransactionDTO) => recurringApi.create(data),
    onSuccess: () => recurringCrudInvalidations(queryClient),
  });
}

export function useUpdateRecurring() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateRecurringTransactionDTO> }) =>
      recurringApi.update(id, data),
    onSuccess: () => recurringCrudInvalidations(queryClient),
  });
}