import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { categoryAPI } from '../api/client';
import type { CreateCategoryDTO, TransactionType } from '../types';

export const useCategories = (filterType?: TransactionType | 'ALL') => {
  const params = filterType !== 'ALL' ? { type: filterType } : {};
  
  return useQuery({
    queryKey: ['categories', filterType],
    queryFn: () => categoryAPI.getAll(params),
    staleTime: 10 * 60 * 1000, // 10 minuti - le categorie cambiano raramente
  });
};

export const useCreateCategory = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: CreateCategoryDTO) => categoryAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });
};

export const useUpdateCategory = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateCategoryDTO> }) => 
      categoryAPI.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });
};

export const useDeleteCategory = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => categoryAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
};