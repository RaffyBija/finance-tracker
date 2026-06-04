import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useRef } from 'react';
import { accountsAPI } from '../api/accounts';
import { broadcastInvalidation } from '../utils/syncChannel';
import type { Account, CreateAccountDTO, UpdateAccountDTO } from '../types';

const ACCOUNT_KEYS = ['accounts'];
const ACCOUNT_DELETE_KEYS = ['accounts', 'transactions', 'dashboard', 'planned', 'recurring', 'calendar', 'billing-cycles'];

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

export const useAccount = (id: string | undefined) => {
  return useQuery({
    queryKey: ['accounts', id],
    queryFn: () => accountsAPI.getById(id as string),
    enabled: !!id,
    staleTime: 60 * 1000,
  });
};

export const useBillingCycles = (accountId: string | null, enabled = true) => {
  return useQuery({
    queryKey: ['billing-cycles', accountId],
    queryFn: () => accountsAPI.getCycles(accountId as string),
    enabled: enabled && !!accountId,
    staleTime: 60 * 1000,
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

export const useCloseBillingCycle = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (accountId: string) => accountsAPI.closeBillingCycle(accountId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['planned'] });
      queryClient.invalidateQueries({ queryKey: ['calendar'] });
      queryClient.invalidateQueries({ queryKey: ['pending-planned'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['billing-cycles'] });
    },
  });
};

const CC_BILLING_KEY  = 'ccBillingCheck';
const CC_CLOSING_KEY  = 'ccClosingCheck';

export function useCCBillingDue() {
  const today    = new Date().toISOString().split('T')[0];
  const todayDay = new Date().getDate();

  // Gate per il billing day (modal di pagamento)
  const [billingEnabled] = useState(() => localStorage.getItem(CC_BILLING_KEY) !== today);
  // Gate per il closing day (chiusura ciclo automatica)
  const [closingEnabled] = useState(() => localStorage.getItem(CC_CLOSING_KEY) !== today);

  const [isOpen, setIsOpen]       = useState(false);
  const [dueAccount, setDueAccount] = useState<Account | null>(null);
  const cycleClosedRef = useRef(false);

  const { data: accounts = [] } = useAccounts();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (accounts.length === 0) return;

    // 1. Chiusura ciclo automatica (closingDay = oggi)
    if (closingEnabled && !cycleClosedRef.current) {
      const toClose = accounts.filter(
        (a) => a.type === 'CREDIT_CARD' && a.closingDay === todayDay && a.balance < 0
      );
      if (toClose.length > 0) {
        cycleClosedRef.current = true;
        localStorage.setItem(CC_CLOSING_KEY, today);
        toClose.forEach((cc) => {
          accountsAPI.closeBillingCycle(cc.id).then(() => {
            queryClient.invalidateQueries({ queryKey: ['accounts'] });
            queryClient.invalidateQueries({ queryKey: ['planned'] });
            queryClient.invalidateQueries({ queryKey: ['calendar'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard'] });
            queryClient.invalidateQueries({ queryKey: ['pending-planned'] });
          }).catch(() => { /* silenzioso */ });
        });
      }
    }

    // 2. Modal di pagamento (billingDay = oggi, per settle manuale)
    if (billingEnabled) {
      const due = accounts.find(
        (a) => a.type === 'CREDIT_CARD' && a.billingDay === todayDay && a.balance < 0
      ) ?? null;
      if (due) {
        setDueAccount(due);
        setIsOpen(true);
      } else {
        localStorage.setItem(CC_BILLING_KEY, today);
      }
    }
  }, [accounts, billingEnabled, closingEnabled, today, todayDay, queryClient]);

  const dismiss = () => {
    localStorage.setItem(CC_BILLING_KEY, today);
    setIsOpen(false);
    setDueAccount(null);
  };

  return { dueAccount, isOpen, dismiss };
}
