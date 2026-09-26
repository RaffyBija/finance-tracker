import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { accountsAPI } from '../api/accounts';
import { broadcastInvalidation } from '../utils/syncChannel';
import { usePending } from '../contexts/PendingContext';
import { useDailyGate } from './useDailyGate';
import type { CreateAccountDTO, UpdateAccountDTO } from '../types';

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
    // + pending-planned: l'addebito saldato esce dal badge e dal promemoria CC.
    onSuccess: () => invalidateAccounts(queryClient, [...ACCOUNT_DELETE_KEYS, 'pending-planned']),
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

// La chiusura ciclo è responsabilità del backend (closeConcludedCycles, invocata
// da GET /accounts). Qui resta solo il promemoria di pagamento.
//
// Una CC è "da addebitare" se ha una pianificata di settlement (ccAccountId) non
// pagata con data ≤ oggi — la stessa regola di settleAccount lato server. Non si
// usa balance (è il saldo del ciclo APERTO, non l'addebito dovuto) né il giorno
// esatto di billingDay: un addebito saltato resta segnalato finché non è saldato.
export function useCCBillingDue() {
  const { isDismissed, dismiss } = useDailyGate(CC_BILLING_KEY);
  const { data: accounts = [] } = useAccounts();
  const { plannedDueData } = usePending();

  const dueAccount = useMemo(() => {
    if (isDismissed) return null;
    const dueCcIds = new Set(plannedDueData.map((p) => p.ccAccountId).filter(Boolean));
    return accounts.find((a) => a.type === 'CREDIT_CARD' && dueCcIds.has(a.id)) ?? null;
  }, [isDismissed, accounts, plannedDueData]);

  return { dueAccount, isOpen: dueAccount != null, dismiss };
}
