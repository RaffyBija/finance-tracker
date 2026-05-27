import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { plannedApi } from '../api/planned';
import { categoryAPI } from '../api/client';
import { broadcastInvalidation } from '../utils/syncChannel';
import type { CreatePlannedTransactionDTO } from '../types';

const PLANNED_KEYS         = ['planned', 'dashboard', 'pending-planned', 'calendar'];
const PLANNED_PAID_KEYS    = ['planned', 'transactions', 'dashboard', 'pending-planned', 'calendar'];

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

const invalidatePlanned = (queryClient: ReturnType<typeof useQueryClient>, keys: string[]) => {
  keys.forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
  broadcastInvalidation(keys);
};

export function useDeletePlanned() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => plannedApi.delete(id),
    onSuccess: () => invalidatePlanned(queryClient, PLANNED_KEYS),
  });
}

export function useMarkAsPaid() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => plannedApi.markAsPaid(id),
    onSuccess: () => invalidatePlanned(queryClient, PLANNED_PAID_KEYS),
  });
}

export function useCreatePlanned() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreatePlannedTransactionDTO) => plannedApi.create(data),
    onSuccess: () => invalidatePlanned(queryClient, PLANNED_KEYS),
  });
}

export function useUpdatePlanned() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreatePlannedTransactionDTO> }) =>
      plannedApi.update(id, data),
    onSuccess: () => invalidatePlanned(queryClient, PLANNED_KEYS),
  });
}