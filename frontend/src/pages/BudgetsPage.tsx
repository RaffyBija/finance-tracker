import { useBudgets } from '../hooks/useBudgets';
import { useFormModal } from '../hooks/useFormModal';
import { useDeleteConfirm } from '../hooks/useDeleteConfirm';
import PageHeader from '../components/shared/PageHeader';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import BudgetList from '../components/budgets/BudgetList';
import BudgetFormModal from '../components/budgets/BudgetFormModal';
import type { Budget } from '../types';


export const Budgets = () => {
  const {
    budgets,
    categories,
    isLoading,
    refresh,
    handleDelete: apiDelete,
  } = useBudgets();

  const { isOpen, editingItem, openModal, openEditModal, closeModal } =
    useFormModal<Budget>();

  const { confirmDelete } = useDeleteConfirm();

  const handleDelete = async (id: string) => {
    if (!confirmDelete('Sei sicuro di voler eliminare questo budget?')) {
      return;
    }
    try {
      await apiDelete(id);
    } catch (error) {
      alert("Errore nell'eliminazione");
    }
  };

  if (isLoading) {
    return <LoadingSpinner message="Caricamento budget..." />;
  }

  return (
    <div className="container-custom">
      <PageHeader
        title="Budget"
        actionLabel="Nuovo Budget"
        onAction={openModal}
      />

      <BudgetList
        budgets={budgets}
        onEdit={openEditModal}
        onDelete={handleDelete}
        onOpenModal={openModal}
      />

      <BudgetFormModal
        isOpen={isOpen}
        editingItem={editingItem}
        categories={categories}
        onClose={closeModal}
        onSuccess={refresh}
      />
    </div>
  );
};
