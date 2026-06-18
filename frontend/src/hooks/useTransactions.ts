import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { transactionAPI } from '../api/client';
import { broadcastInvalidation } from '../utils/syncChannel';
import type { CreateTransactionDTO, CreateTransferDTO, TransactionType } from '../types';

const TRANSACTION_KEYS = ['transactions', 'dashboard', 'budgets', 'calendar', 'accounts', 'planned', 'billing-cycles'];

const PAGE_SIZE = 20;

interface TransactionFilters {
  type?: TransactionType | 'ALL';
  startDate?: string;
  endDate?: string;
  search?: string;
  page?: number;
  accountId?: string;
}

export const useTransactions = (filters: TransactionFilters = {}) => {
  const { type, startDate, endDate, search, page = 0, accountId } = filters;

  const params: Record<string, any> = {
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  };

  if (type && type !== 'ALL') params.type = type;
  if (startDate) params.startDate = startDate;
  if (endDate) params.endDate = endDate;
  if (search?.trim()) params.search = search.trim();
  if (accountId) params.accountId = accountId;

  return useQuery({
    queryKey: ['transactions', type, startDate, endDate, search, page, accountId],
    queryFn: () => transactionAPI.getAll(params),
    staleTime: 3 * 60 * 1000,
    placeholderData: (prev) => prev, // mantiene i dati precedenti durante il caricamento
  });
};

const invalidateTransactions = (queryClient: ReturnType<typeof useQueryClient>) => {
  TRANSACTION_KEYS.forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
  broadcastInvalidation(TRANSACTION_KEYS);
};

export const useCreateTransaction = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateTransactionDTO) => transactionAPI.create(data),
    onSuccess: () => invalidateTransactions(queryClient),
  });
};

export const useUpdateTransaction = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateTransactionDTO> }) =>
      transactionAPI.update(id, data),
    onSuccess: () => invalidateTransactions(queryClient),
  });
};

export const useDeleteTransaction = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => transactionAPI.delete(id),
    onSuccess: () => invalidateTransactions(queryClient),
  });
};

export const useCreateTransfer = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateTransferDTO) => transactionAPI.createTransfer(data),
    onSuccess: () => invalidateTransactions(queryClient),
  });
};

export const useUpdateTransfer = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ transferId, data }: { transferId: string; data: CreateTransferDTO }) =>
      transactionAPI.updateTransfer(transferId, data),
    onSuccess: () => invalidateTransactions(queryClient),
  });
};

export const useDeleteTransfer = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (transferId: string) => transactionAPI.deleteTransfer(transferId),
    onSuccess: () => invalidateTransactions(queryClient),
  });
};

export { PAGE_SIZE };