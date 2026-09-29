import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { categoryAPI } from '../api/client';
import { broadcastInvalidation } from '../utils/syncChannel';
import type { CreateCategoryDTO, TransactionType } from '../types';

const CATEGORY_KEYS        = ['categories', 'dashboard'];
// Eliminare/unire sposta movimenti, scadenze e budget: tutto ciò che li mostra.
const CATEGORY_DELETE_KEYS = ['categories', 'transactions', 'dashboard', 'budgets', 'recurring', 'planned', 'installments', 'calendar'];

// Categorie attive (le archiviate sono escluse, salvo includeArchived).
export const useCategories = (filterType?: TransactionType | 'ALL', includeArchived = false) => {
  const params = {
    ...(filterType && filterType !== 'ALL' ? { type: filterType } : {}),
    ...(includeArchived ? { includeArchived: true } : {}),
  };

  return useQuery({
    queryKey: ['categories', filterType ?? 'ALL', includeArchived ? 'all' : 'active'],
    queryFn: () => categoryAPI.getAll(params),
    staleTime: 10 * 60 * 1000, // 10 minuti - le categorie cambiano raramente
  });
};

const invalidateCategories = (queryClient: ReturnType<typeof useQueryClient>, keys: string[]) => {
  keys.forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
  broadcastInvalidation(keys);
};

export const useCreateCategory = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateCategoryDTO) => categoryAPI.create(data),
    onSuccess: () => invalidateCategories(queryClient, CATEGORY_KEYS),
  });
};

export const useUpdateCategory = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateCategoryDTO> }) =>
      categoryAPI.update(id, data),
    onSuccess: () => invalidateCategories(queryClient, CATEGORY_KEYS),
  });
};

export const useDeleteCategory = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, targetId }: { id: string; targetId?: string }) => categoryAPI.delete(id, targetId),
    onSuccess: () => invalidateCategories(queryClient, CATEGORY_DELETE_KEYS),
  });
};

export const useMergeCategory = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, targetId }: { id: string; targetId: string }) => categoryAPI.merge(id, targetId),
    onSuccess: () => invalidateCategories(queryClient, CATEGORY_DELETE_KEYS),
  });
};

export const useArchiveCategory = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, restore }: { id: string; restore?: boolean }) =>
      restore ? categoryAPI.restore(id) : categoryAPI.archive(id),
    onSuccess: () => invalidateCategories(queryClient, CATEGORY_KEYS),
  });
};

export const useReorderCategories = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => categoryAPI.reorder(ids),
    onSuccess: () => invalidateCategories(queryClient, ['categories']),
  });
};

// Utilizzi di una categoria (caricati solo quando si apre la conferma).
export const useCategoryUsage = (id: string | null) => {
  return useQuery({
    queryKey: ['categories', 'usage', id],
    queryFn: () => categoryAPI.usage(id!),
    enabled: !!id,
    staleTime: 0,
  });
};

export const useOrganizePreview = (enabled: boolean) => {
  return useQuery({
    queryKey: ['categories', 'organize'],
    queryFn: categoryAPI.organizePreview,
    enabled,
    staleTime: 0,
  });
};

export const useApplyOrganize = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: categoryAPI.organizeApply,
    onSuccess: () => invalidateCategories(queryClient, CATEGORY_DELETE_KEYS),
  });
};
