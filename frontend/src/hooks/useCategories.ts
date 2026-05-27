import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { categoryAPI } from '../api/client';
import { broadcastInvalidation } from '../utils/syncChannel';
import type { CreateCategoryDTO, TransactionType } from '../types';

const CATEGORY_KEYS        = ['categories'];
const CATEGORY_DELETE_KEYS = ['categories', 'transactions', 'dashboard'];

export const useCategories = (filterType?: TransactionType | 'ALL') => {
  const params = filterType !== 'ALL' ? { type: filterType } : {};
  
  return useQuery({
    queryKey: ['categories', filterType],
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
    mutationFn: (id: string) => categoryAPI.delete(id),
    onSuccess: () => invalidateCategories(queryClient, CATEGORY_DELETE_KEYS),
  });
};