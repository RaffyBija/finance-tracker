import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
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

// La chiusura ciclo è ora responsabilità del backend (closeConcludedCycles, invocata
// da GET /accounts): si auto-ripara a ogni caricamento conti, a prescindere dal
// giorno esatto di chiusura e dai mesi più corti del closingDay "Fine mese". Qui
// resta solo il promemoria di pagamento al billingDay.
export function useCCBillingDue() {
  const today    = new Date().toISOString().split('T')[0];
  const todayDay = new Date().getDate();

  // Gate per il billing day (modal di pagamento)
  const [billingEnabled] = useState(() => localStorage.getItem(CC_BILLING_KEY) !== today);

  const [isOpen, setIsOpen]       = useState(false);
  const [dueAccount, setDueAccount] = useState<Account | null>(null);

  const { data: accounts = [] } = useAccounts();

  useEffect(() => {
    if (accounts.length === 0 || !billingEnabled) return;

    // Modal di pagamento: mostra il promemoria se una CC è dovuta oggi (billingDay,
    // con clamping ai mesi corti) e ha debito.
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const due = accounts.find(
      (a) =>
        a.type === 'CREDIT_CARD' &&
        a.balance < 0 &&
        a.billingDay != null &&
        Math.min(a.billingDay, daysInMonth) === todayDay,
    ) ?? null;

    if (due) {
      setDueAccount(due);
      setIsOpen(true);
    } else {
      localStorage.setItem(CC_BILLING_KEY, today);
    }
  }, [accounts, billingEnabled, today, todayDay]);

  const dismiss = () => {
    localStorage.setItem(CC_BILLING_KEY, today);
    setIsOpen(false);
    setDueAccount(null);
  };

  return { dueAccount, isOpen, dismiss };
}
