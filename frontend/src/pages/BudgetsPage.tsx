import { useState } from 'react';
import { Plus, Sparkles } from 'lucide-react';
import { useBudgets, useDeleteBudget } from '../hooks/useBudgets';
import { useFormModal } from '../hooks/useFormModal';
import PageHeader from '../components/shared/PageHeader';
import { SkeletonPageHeader, SkeletonCardGrid } from '../components/shared/Skeleton';
import BudgetList from '../components/budgets/BudgetList';
import BudgetSummary from '../components/budgets/BudgetSummary';
import BudgetFormModal from '../components/budgets/BudgetFormModal';
import BudgetDetailModal from '../components/budgets/BudgetDetailModal';
import BudgetSuggestionsModal from '../components/budgets/BudgetSuggestionsModal';
import ConfirmModal from '../components/shared/ConfirmModal';
import type { Budget } from '../types';
import { useToast } from '../contexts/ToastContext';

export const Budgets = () => {
  const { budgets, categories, isLoading } = useBudgets();
  const deleteMutation = useDeleteBudget();
  const { isOpen, editingItem, openModal, openEditModal, closeModal } = useFormModal<Budget>();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [detailItem, setDetailItem] = useState<Budget | null>(null);
  const [suggestOpen, setSuggestOpen] = useState(false);

  const toast = useToast();

  const handleEditFromDetail = (budget: Budget) => {
    setDetailItem(null);
    openEditModal(budget);
  };

  const handleDeleteFromDetail = (id: string) => {
    setDetailItem(null);
    setDeletingId(id);
  };

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
          <PageHeader
            title="Budget"
            info="I budget seguono la spesa discrezionale e si azzerano a ogni periodo. Gli impegni fissi (rate, abbonamenti) non rientrano qui."
          />
          <button
            type="button"
            className="btn btn-ghost btn-md budget-sugg-trigger"
            onClick={() => setSuggestOpen(true)}
          >
            <Sparkles className="icon-md" />
            <span>Proponi budget</span>
          </button>
          <BudgetSummary budgets={budgets} />
          <BudgetList
            budgets={budgets}
            onOpenModal={openModal}
            onCardClick={setDetailItem}
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

      <BudgetDetailModal
        isOpen={!!detailItem}
        budget={detailItem}
        onClose={() => setDetailItem(null)}
        onEdit={handleEditFromDetail}
        onDelete={handleDeleteFromDetail}
      />

      <BudgetSuggestionsModal
        isOpen={suggestOpen}
        onClose={() => setSuggestOpen(false)}
      />

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
