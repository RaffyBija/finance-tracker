import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { budgetApi } from '../api/budgets';
import { categoryAPI } from '../api/client';
import { broadcastInvalidation } from '../utils/syncChannel';
import type { CreateBudgetDTO } from '../types';

const BUDGET_KEYS = ['budgets', 'budget-history', 'budget-suggestions', 'dashboard'];

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

export function useBudgetHistory(id: string | null, periods?: number) {
  return useQuery({
    queryKey: ['budget-history', id, periods],
    queryFn: () => budgetApi.getHistory(id as string, periods),
    enabled: !!id,
    staleTime: 3 * 60 * 1000,
  });
}

// Suggerimenti budget automatico. `savingRate` (override slider) entra nella queryKey
// così cambiare lo slider rifà la query; `enabled` per caricare solo quando serve.
// `monthOffset` (0 corrente / 1 prossimo) e `accountIds` (conti BANK inclusi) entrano
// anch'essi nella key: cambiarli rifà la query e colpisce una variante cache distinta.
export function useBudgetSuggestions(
  savingRate: number | undefined,
  enabled: boolean,
  monthOffset = 0,
  accountIds?: string[],
) {
  const acctKey = accountIds && accountIds.length > 0 ? [...accountIds].sort().join('-') : 'all';
  return useQuery({
    queryKey: ['budget-suggestions', savingRate ?? 'profile', monthOffset, acctKey],
    queryFn: () => budgetApi.getSuggestions(savingRate, monthOffset, accountIds),
    enabled,
    staleTime: 60 * 1000,
  });
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

export function useApplySuggestions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (items: Array<{ categoryId: string; amount: number }>) =>
      budgetApi.applySuggestions(items),
    onSuccess: () => invalidateBudgets(queryClient),
  });
}