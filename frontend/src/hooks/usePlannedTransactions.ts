import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { plannedApi } from '../api/planned';
import { categoryAPI } from '../api/client';
import type { CreatePlannedTransactionDTO } from '../types';

type FilterStatus = 'ALL' | 'UNPAID' | 'PAID';

export function usePlannedTransactions() {
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('UNPAID');

  const { data: planned = [], isLoading: plannedLoading } = useQuery({
    queryKey: ['planned', filterStatus],
    queryFn: async () => {
      const params = filterStatus === 'UNPAID' ? { unpaidOnly: true } : {};
      const data = await plannedApi.getAll(params);
      if (filterStatus === 'PAID') return data.filter((p) => p.isPaid);
      if (filterStatus === 'UNPAID') return data.filter((p) => !p.isPaid);
      return data;
    },
    staleTime: 2 * 60 * 1000,
  });

  const { data: categories = [], isLoading: categoriesLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoryAPI.getAll(),
    staleTime: 10 * 60 * 1000,
  });

  return {
    planned,
    categories,
    isLoading: plannedLoading,
    categoriesLoading,
    filterStatus,
    setFilterStatus,
  };
}

export function useDeletePlanned() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => plannedApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['planned'] }),
  });
}

export function useMarkAsPaid() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => plannedApi.markAsPaid(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['planned'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useCreatePlanned() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreatePlannedTransactionDTO) => plannedApi.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['planned'] }),
  });
}