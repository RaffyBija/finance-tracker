import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { budgetApi } from '../api/budgets';
import { categoryAPI } from '../api/client';
import { broadcastInvalidation } from '../utils/syncChannel';
import type { CreateBudgetDTO } from '../types';

const BUDGET_KEYS = ['budgets', 'budget-history', 'budget-suggestions', 'dashboard'];

export function useBudgets() {
  const { data: budgets = [], isLoading: budgetsLoading, isError: budgetsError } = useQuery({
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
    isError: budgetsError,
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
// `period` (periodo di paga / mese), `offset` (0 corrente / 1 successivo) e
// `accountIds` (conti BANK inclusi) entrano anch'essi nella key.
export function useBudgetSuggestions(
  savingRate: number | undefined,
  enabled: boolean,
  opts: { period?: 'pay' | 'month'; offset?: number; accountIds?: string[] } = {},
) {
  const { period = 'pay', offset = 0, accountIds } = opts;
  const acctKey = accountIds && accountIds.length > 0 ? [...accountIds].sort().join('-') : 'all';
  return useQuery({
    queryKey: ['budget-suggestions', savingRate ?? 'profile', period, offset, acctKey],
    queryFn: () => budgetApi.getSuggestions(savingRate, { period, offset, accountIds }),
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
    mutationFn: ({ items, period }: { items: Array<{ categoryId: string; amount: number }>; period: 'PAY_PERIOD' | 'MONTHLY' }) =>
      budgetApi.applySuggestions(items, period),
    onSuccess: () => invalidateBudgets(queryClient),
  });
}