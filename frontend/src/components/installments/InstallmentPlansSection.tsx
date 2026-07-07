import { useState } from 'react';
import { Plus, Layers } from 'lucide-react';
import {
  useInstallmentPlans,
  useDeleteInstallmentPlan,
  usePayInstallments,
} from '../../hooks/useInstallmentPlans';
import { useFormModal } from '../../hooks/useFormModal';
import { useToast } from '../../contexts/ToastContext';
import { SkeletonList } from '../shared/Skeleton';
import EmptyState from '../shared/EmptyState';
import ConfirmModal from '../shared/ConfirmModal';
import InstallmentPlanCard from './InstallmentPlanCard';
import InstallmentPlanDetailModal from './InstallmentPlanDetailModal';
import InstallmentPlanFormModal from './InstallmentPlanFormModal';
import PayInstallmentsModal from './PayInstallmentsModal';
import type { InstallmentPlan } from '../../types';

interface PayTarget {
  plan: InstallmentPlan;
  ids: string[];
}

export default function InstallmentPlansSection() {
  const { plans, categories, isLoading } = useInstallmentPlans();
  const deleteMutation = useDeleteInstallmentPlan();
  const payMutation = usePayInstallments();
  const { isOpen, editingItem, openModal, openEditModal, closeModal } =
    useFormModal<InstallmentPlan>();
  const toast = useToast();

  const [detailId, setDetailId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [payTarget, setPayTarget] = useState<PayTarget | null>(null);

  // Il dettaglio legge sempre il piano fresco dalla query (non uno snapshot),
  // così dopo un refetch la lista rate resta aggiornata.
  const detailPlan = plans.find((p) => p.id === detailId) ?? null;

  // Le azioni dal dettaglio chiudono il dettaglio e aprono il modal dedicato
  // (stesso flusso di BudgetDetailModal: mai due modali impilati).
  const handleEditFromDetail = (plan: InstallmentPlan) => {
    setDetailId(null);
    openEditModal(plan);
  };

  const handleDeleteFromDetail = (id: string) => {
    setDetailId(null);
    setDeletingId(id);
  };

  const handlePayFromDetail = (plan: InstallmentPlan, ids: string[]) => {
    setDetailId(null);
    setPayTarget({ plan, ids });
  };

  const handleConfirmDelete = async () => {
    if (!deletingId) return;
    try {
      await deleteMutation.mutateAsync(deletingId);
      toast.success('Piano eliminato');
      setDeletingId(null);
    } catch {
      toast.error("Errore nell'eliminazione");
    }
  };

  const handleConfirmPay = async ({ accountId, date }: { accountId?: string; date: string }) => {
    if (!payTarget) return;
    try {
      const res = await payMutation.mutateAsync({ plannedIds: payTarget.ids, accountId, date });
      toast.success(res.message);
      setPayTarget(null);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Errore nella registrazione');
    }
  };

  const payRate = payTarget
    ? payTarget.plan.installments.filter((r) => payTarget.ids.includes(r.id))
    : [];

  return (
    <div className="scadenzario-section">
      {isLoading ? (
        <SkeletonList rows={4} />
      ) : plans.length === 0 ? (
        <EmptyState
          icon={<Layers size={22} />}
          title="Nessun piano a rate"
          description="Crea un piano per un debito o un credito dilazionato (es. un acquisto a rate, soldi che ti devono tornare)."
          actionLabel="Nuovo piano a rate"
          onAction={openModal}
        />
      ) : (
        <div className="plan-card-grid">
          {plans.map((plan) => (
            <InstallmentPlanCard key={plan.id} plan={plan} onOpen={(p) => setDetailId(p.id)} />
          ))}
        </div>
      )}

      {!isLoading && (
        <button className="fab" onClick={openModal} aria-label="Nuovo piano a rate">
          <Plus size={22} />
          <span className="fab-label">Nuovo piano</span>
        </button>
      )}

      <InstallmentPlanDetailModal
        isOpen={!!detailPlan}
        plan={detailPlan}
        onClose={() => setDetailId(null)}
        onEdit={handleEditFromDetail}
        onDelete={handleDeleteFromDetail}
        onPay={handlePayFromDetail}
      />

      <InstallmentPlanFormModal
        isOpen={isOpen}
        editingItem={editingItem}
        categories={categories}
        onClose={closeModal}
      />

      <PayInstallmentsModal
        isOpen={!!payTarget}
        plan={payTarget?.plan ?? null}
        rate={payRate}
        isPending={payMutation.isPending}
        onConfirm={handleConfirmPay}
        onClose={() => setPayTarget(null)}
      />

      <ConfirmModal
        isOpen={!!deletingId}
        title="Elimina piano a rate"
        message="Le rate non ancora saldate verranno eliminate. Le rate già pagate restano nello storico. L'operazione non può essere annullata."
        confirmLabel="Elimina"
        isPending={deleteMutation.isPending}
        onConfirm={handleConfirmDelete}
        onClose={() => setDeletingId(null)}
      />
    </div>
  );
}
