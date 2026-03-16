import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { budgetApi } from '../api/budgets';
import { categoryAPI } from '../api/client';
import type { CreateBudgetDTO } from '../types';

export function useBudgets() {
  const { data: budgets = [], isLoading: budgetsLoading } = useQuery({
    queryKey: ['budgets'],
    queryFn: () => budgetApi.getAll(),
    staleTime: 3 * 60 * 1000,
  });

  const { data: categories = [], isLoading: categoriesLoading } = useQuery({
    queryKey: ['categories', 'EXPENSE'],
    queryFn: () => categoryAPI.getAll({ type: 'EXPENSE' }),
    staleTime: 10 * 60 * 1000,
  });

  return {
    budgets,
    categories,
    isLoading: budgetsLoading,
    categoriesLoading,
  };
}

export function useDeleteBudget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => budgetApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useCreateBudget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateBudgetDTO) => budgetApi.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['budgets'] }),
  });
}

export function useUpdateBudget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateBudgetDTO> }) =>
      budgetApi.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['budgets'] }),
  });
}