import { useRecurringTransactions } from '../hooks/useRecurringTransactions';
import { useFormModal } from '../hooks/useFormModal';
import { useDeleteConfirm } from '../hooks/useDeleteConfirm';
import PageHeader from '../components/shared/PageHeader';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import RecurringList from '../components/recurring/RecurringList';
import RecurringFormModal from '../components/recurring/RecurringFormModal';
import type { RecurringTransaction } from '../types';


export const RecurringTransactions = () => {
  const {
    recurring,
    categories,
    isLoading,
    refresh,
    handleDelete: apiDelete,
    handleToggle: apiToggle,
  } = useRecurringTransactions();

  const { isOpen, editingItem, openModal, openEditModal, closeModal } =
    useFormModal<RecurringTransaction>();

  const { confirmDelete } = useDeleteConfirm();

  const handleDelete = async (id: string) => {
    if (!confirmDelete('Sei sicuro di voler eliminare questa spesa ricorrente?')) {
      return;
    }
    try {
      await apiDelete(id);
    } catch (error) {
      alert("Errore nell'eliminazione");
    }
  };

  const handleToggle = async (id: string) => {
    try {
      await apiToggle(id);
    } catch (error) {
      alert('Errore nel cambio stato');
    }
  };

  if (isLoading) {
    return <LoadingSpinner message="Caricamento spese ricorrenti..." />;
  }

  return (
    <div className="container-custom">
      <PageHeader
        title="Spese Ricorrenti"
        actionLabel="Nuova Spesa Ricorrente"
        onAction={openModal}
      />

      <RecurringList
        recurring={recurring}
        onEdit={openEditModal}
        onDelete={handleDelete}
        onToggle={handleToggle}
        onOpenModal={openModal}
      />

      <RecurringFormModal
        isOpen={isOpen}
        editingItem={editingItem}
        categories={categories}
        onClose={closeModal}
        onSuccess={refresh}
      />
    </div>
  );
};
