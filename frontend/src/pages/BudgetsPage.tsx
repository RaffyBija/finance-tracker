import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useBudgets, useDeleteBudget } from '../hooks/useBudgets';
import { useFormModal } from '../hooks/useFormModal';
import PageHeader from '../components/shared/PageHeader';
import { SkeletonPageHeader, SkeletonCardGrid } from '../components/shared/Skeleton';
import BudgetList from '../components/budgets/BudgetList';
import BudgetFormModal from '../components/budgets/BudgetFormModal';
import ConfirmModal from '../components/shared/ConfirmModal';
import type { Budget } from '../types';
import { useToast } from '../contexts/ToastContext';

export const Budgets = () => {
  const { budgets, categories, isLoading } = useBudgets();
  const deleteMutation = useDeleteBudget();
  const { isOpen, editingItem, openModal, openEditModal, closeModal } = useFormModal<Budget>();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const toast = useToast();

  const handleConfirmDelete = async () => {
    if (!deletingId) return;
    try {
      await deleteMutation.mutateAsync(deletingId);
      toast.success('Budget eliminato');
      setDeletingId(null);
    } catch {
      toast.error("Errore nell'eliminazione");
    }
  };

  return (
    <div className="container-custom">
      {isLoading ? (
        <>
          <SkeletonPageHeader />
          <SkeletonCardGrid cols={3} rows={2} />
        </>
      ) : (
        <>
          <PageHeader title="Budget" />
          <BudgetList
            budgets={budgets}
            onEdit={openEditModal}
            onDelete={setDeletingId}
            onOpenModal={openModal}
          />
        </>
      )}

      {/* ── Floating Action Button ── */}
      {!isLoading && (
        <button className="fab" onClick={openModal} aria-label="Nuovo budget">
          <Plus size={22} />
          <span className="fab-label">Nuovo</span>
        </button>
      )}

      <BudgetFormModal
        isOpen={isOpen}
        editingItem={editingItem}
        categories={categories}
        onClose={closeModal}
        onSuccess={() => {}}
      />

      <ConfirmModal
        isOpen={!!deletingId}
        title="Elimina budget"
        message="Sei sicuro di voler eliminare questo budget? L'operazione non può essere annullata."
        confirmLabel="Elimina"
        isPending={deleteMutation.isPending}
        onConfirm={handleConfirmDelete}
        onClose={() => setDeletingId(null)}
      />
    </div>
  );
};
