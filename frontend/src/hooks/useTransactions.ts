import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { transactionAPI } from '../api/client';
import type { CreateTransactionDTO, TransactionType } from '../types';

const PAGE_SIZE = 20;

interface TransactionFilters {
  type?: TransactionType | 'ALL';
  startDate?: string;
  endDate?: string;
  page?: number;
}

export const useTransactions = (filters: TransactionFilters = {}) => {
  const { type, startDate, endDate, page = 0 } = filters;

  const params: Record<string, any> = {
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  };

  if (type && type !== 'ALL') params.type = type;
  if (startDate) params.startDate = startDate;
  if (endDate) params.endDate = endDate;

  return useQuery({
    queryKey: ['transactions', type, startDate, endDate, page],
    queryFn: () => transactionAPI.getAll(params),
    staleTime: 3 * 60 * 1000,
    placeholderData: (prev) => prev, // mantiene i dati precedenti durante il caricamento
  });
};

export const useCreateTransaction = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateTransactionDTO) => transactionAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
    },
  });
};

export const useUpdateTransaction = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateTransactionDTO> }) =>
      transactionAPI.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
    },
  });
};

export const useDeleteTransaction = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => transactionAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
    },
  });
};

export { PAGE_SIZE };