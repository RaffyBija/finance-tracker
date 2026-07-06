import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { installmentsApi } from '../api/installments';
import { categoryAPI } from '../api/client';
import { broadcastInvalidation } from '../utils/syncChannel';
import type {
  CreateInstallmentPlanDTO,
  UpdateInstallmentPlanDTO,
  PayInstallmentsDTO,
} from '../types';

// CRUD del piano: tocca il piano stesso, le rate (pianificate → badge/scadenze),
// dashboard, contatori pending e calendario.
const INSTALLMENT_KEYS = ['installments', 'planned', 'dashboard', 'pending-planned', 'pending-installments', 'calendar'];
// Pagamento: crea una transazione reale → invalida anche transazioni, conti.
const INSTALLMENT_PAID_KEYS = ['installments', 'planned', 'transactions', 'dashboard', 'pending-planned', 'pending-installments', 'calendar', 'accounts'];

export function useInstallmentPlans() {
  const { data: plans = [], isLoading } = useQuery({
    queryKey: ['installments'],
    queryFn: () => installmentsApi.getAll(),
    staleTime: 2 * 60 * 1000,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoryAPI.getAll(),
    staleTime: 10 * 60 * 1000,
  });

  return { plans, categories, isLoading };
}

const invalidate = (queryClient: ReturnType<typeof useQueryClient>, keys: string[]) => {
  keys.forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
  broadcastInvalidation(keys);
};

export function useCreateInstallmentPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateInstallmentPlanDTO) => installmentsApi.create(data),
    onSuccess: () => invalidate(queryClient, INSTALLMENT_KEYS),
  });
}

export function useUpdateInstallmentPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateInstallmentPlanDTO }) =>
      installmentsApi.update(id, data),
    onSuccess: () => invalidate(queryClient, INSTALLMENT_KEYS),
  });
}

export function useDeleteInstallmentPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => installmentsApi.delete(id),
    onSuccess: () => invalidate(queryClient, INSTALLMENT_KEYS),
  });
}

export function usePayInstallments() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: PayInstallmentsDTO) => installmentsApi.pay(data),
    onSuccess: () => invalidate(queryClient, INSTALLMENT_PAID_KEYS),
  });
}
