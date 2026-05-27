import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { budgetApi } from '../api/budgets';
import { categoryAPI } from '../api/client';
import { broadcastInvalidation } from '../utils/syncChannel';
import type { CreateBudgetDTO } from '../types';

const BUDGET_KEYS = ['budgets', 'dashboard'];

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

const invalidateBudgets = (queryClient: ReturnType<typeof useQueryClient>) => {
  BUDGET_KEYS.forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
  broadcastInvalidation(BUDGET_KEYS);
};

export function useDeleteBudget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => budgetApi.delete(id),
    onSuccess: () => invalidateBudgets(queryClient),
  });
}

export function useCreateBudget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateBudgetDTO) => budgetApi.create(data),
    onSuccess: () => invalidateBudgets(queryClient),
  });
}

export function useUpdateBudget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateBudgetDTO> }) =>
      budgetApi.update(id, data),
    onSuccess: () => invalidateBudgets(queryClient),
  });
}