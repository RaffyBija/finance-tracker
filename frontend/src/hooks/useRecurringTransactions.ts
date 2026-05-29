import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { recurringApi } from '../api/recurring';
import { categoryAPI } from '../api/client';
import { broadcastInvalidation } from '../utils/syncChannel';
import type { CreateRecurringTransactionDTO, RecurringDueResponse } from '../types';

const RECURRING_EXECUTE_KEYS = ['transactions', 'dashboard', 'recurring', 'recurring-due', 'pending-recurring', 'calendar', 'accounts'];
const RECURRING_CRUD_KEYS    = ['recurring', 'dashboard', 'pending-recurring', 'calendar'];

const DUE_CHECK_KEY = 'recurringDueCheck';

export function useRecurringDue() {
  const today = new Date().toISOString().split('T')[0];
  const [enabled] = useState(() => localStorage.getItem(DUE_CHECK_KEY) !== today);
  const [isOpen, setIsOpen] = useState(false);

  const { data } = useQuery<RecurringDueResponse>({
    queryKey: ['recurring-due'],
    queryFn: recurringApi.getDue,
    enabled,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  useEffect(() => {
    if (!data) return;
    const total = data.dueToday.length + data.overdue.length;
    if (total > 0) {
      setIsOpen(true);
    } else {
      localStorage.setItem(DUE_CHECK_KEY, today);
    }
  }, [data, today]);

  const dismiss = () => {
    localStorage.setItem(DUE_CHECK_KEY, today);
    setIsOpen(false);
  };

  return { data: data ?? null, isOpen, dismiss };
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