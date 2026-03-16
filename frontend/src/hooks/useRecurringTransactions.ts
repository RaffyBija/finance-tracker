import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { recurringApi } from '../api/recurring';
import { categoryAPI } from '../api/client';
import type { CreateRecurringTransactionDTO } from '../types';

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

export function useDeleteRecurring() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => recurringApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useToggleRecurring() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => recurringApi.toggle(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['recurring'] }),
  });
}

export function useCreateRecurring() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateRecurringTransactionDTO) => recurringApi.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['recurring'] }),
  });
}

export function useUpdateRecurring() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateRecurringTransactionDTO> }) =>
      recurringApi.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['recurring'] }),
  });
}