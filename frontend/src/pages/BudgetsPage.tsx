import { useBudgets, useDeleteBudget } from '../hooks/useBudgets';
import { useFormModal } from '../hooks/useFormModal';
import { useDeleteConfirm } from '../hooks/useDeleteConfirm';
import PageHeader from '../components/shared/PageHeader';
import { SkeletonPageHeader, SkeletonCardGrid } from '../components/shared/Skeleton';
import BudgetList from '../components/budgets/BudgetList';
import BudgetFormModal from '../components/budgets/BudgetFormModal';
import type { Budget } from '../types';

export const Budgets = () => {
  const { budgets, categories, isLoading } = useBudgets();
  const deleteMutation = useDeleteBudget();
  const { isOpen, editingItem, openModal, openEditModal, closeModal } = useFormModal<Budget>();
  const { confirmDelete } = useDeleteConfirm();

  const handleDelete = async (id: string) => {
    if (!confirmDelete('Sei sicuro di voler eliminare questo budget?')) return;
    await deleteMutation.mutateAsync(id);
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
          <PageHeader title="Budget" actionLabel="Nuovo Budget" onAction={openModal} />
          <BudgetList
            budgets={budgets}
            onEdit={openEditModal}
            onDelete={handleDelete}
            onOpenModal={openModal}
          />
        </>
      )}

      <BudgetFormModal
        isOpen={isOpen}
        editingItem={editingItem}
        categories={categories}
        onClose={closeModal}
        onSuccess={() => {}} // React Query invalida automaticamente
      />
    </div>
  );
};