import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { accountsAPI } from '../api/accounts';
import { broadcastInvalidation } from '../utils/syncChannel';
import type { Account, CreateAccountDTO, UpdateAccountDTO } from '../types';

const ACCOUNT_KEYS = ['accounts'];
const ACCOUNT_DELETE_KEYS = ['accounts', 'transactions', 'dashboard', 'planned', 'recurring', 'calendar'];

const invalidateAccounts = (queryClient: ReturnType<typeof useQueryClient>, keys: string[]) => {
  keys.forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
  broadcastInvalidation(keys);
};

export const useAccounts = () => {
  return useQuery({
    queryKey: ['accounts'],
    queryFn: () => accountsAPI.getAll(),
    staleTime: 5 * 60 * 1000,
  });
};

export const useDefaultAccount = () => {
  return useQuery({
    queryKey: ['accounts'],
    queryFn: () => accountsAPI.getAll(),
    staleTime: 5 * 60 * 1000,
    select: (accounts) => accounts.find((a) => a.isDefault) ?? accounts[0] ?? null,
  });
};

export const useCreateAccount = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateAccountDTO) => accountsAPI.create(data),
    onSuccess: () => invalidateAccounts(queryClient, ACCOUNT_KEYS),
  });
};

export const useUpdateAccount = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateAccountDTO }) =>
      accountsAPI.update(id, data),
    onSuccess: () => invalidateAccounts(queryClient, ACCOUNT_KEYS),
  });
};

export const useDeleteAccount = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => accountsAPI.delete(id),
    onSuccess: () => invalidateAccounts(queryClient, ACCOUNT_DELETE_KEYS),
  });
};

export const useSetDefaultAccount = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => accountsAPI.setDefault(id),
    onSuccess: () => invalidateAccounts(queryClient, ACCOUNT_KEYS),
  });
};

export const useSettleAccount = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, categoryId }: { id: string; categoryId?: string }) =>
      accountsAPI.settle(id, categoryId),
    onSuccess: () => invalidateAccounts(queryClient, ACCOUNT_DELETE_KEYS),
  });
};

const CC_BILLING_KEY = 'ccBillingCheck';

export function useCCBillingDue() {
  const today = new Date().toISOString().split('T')[0];
  const todayDay = new Date().getDate();

  const [enabled] = useState(() => localStorage.getItem(CC_BILLING_KEY) !== today);
  const [isOpen, setIsOpen] = useState(false);
  const [dueAccount, setDueAccount] = useState<Account | null>(null);

  const { data: accounts = [] } = useAccounts();

  useEffect(() => {
    if (!enabled || accounts.length === 0) return;
    const due = accounts.find(
      (a) => a.type === 'CREDIT_CARD' && a.billingDay === todayDay && a.balance < 0
    ) ?? null;
    if (due) {
      setDueAccount(due);
      setIsOpen(true);
    } else {
      localStorage.setItem(CC_BILLING_KEY, today);
    }
  }, [accounts, enabled, today, todayDay]);

  const dismiss = () => {
    localStorage.setItem(CC_BILLING_KEY, today);
    setIsOpen(false);
    setDueAccount(null);
  };

  return { dueAccount, isOpen, dismiss };
}
