import { usePlannedTransactions } from '../hooks/usePlannedTransactions';
import { useFormModal } from '../hooks/useFormModal';
import { useDeleteConfirm } from '../hooks/useDeleteConfirm';
import PageHeader from '../components/shared/PageHeader';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import PlannedFilters from '../components/planned/PlannedFilters';
import PlannedList from '../components/planned/PlannedList';
import PlannedFormModal from '../components/planned/PlannedFormModal';
import type { PlannedTransaction } from '../types';


export const PlannedTransactions = () => {
  const {
    planned,
    categories,
    isLoading,
    filterStatus,
    setFilterStatus,
    refresh,
    handleDelete: apiDelete,
    handleMarkAsPaid: apiMarkAsPaid,
  } = usePlannedTransactions();

  const { isOpen, editingItem, openModal, openEditModal, closeModal } =
    useFormModal<PlannedTransaction>();

  const { confirmDelete } = useDeleteConfirm();

  const handleDelete = async (id: string) => {
    if (!confirmDelete('Sei sicuro di voler eliminare questa spesa pianificata?')) {
      return;
    }
    try {
      await apiDelete(id);
    } catch (error) {
      alert("Errore nell'eliminazione");
    }
  };

  const handleMarkAsPaid = async (id: string) => {
    if (!confirmDelete('Segnare come pagato? Verrà creata una transazione reale.')) {
      return;
    }
    try {
      await apiMarkAsPaid(id);
    } catch (error) {
      alert('Errore nel salvataggio');
    }
  };

  if (isLoading) {
    return <LoadingSpinner message="Caricamento spese pianificate..." />;
  }

  return (
    <div className="container-custom">
      <PageHeader
        title="Spese Pianificate"
        actionLabel="Nuova Spesa Pianificata"
        onAction={openModal}
      />

      <PlannedFilters filterStatus={filterStatus} setFilterStatus={setFilterStatus} />

      <PlannedList
        planned={planned}
        onEdit={openEditModal}
        onDelete={handleDelete}
        onMarkAsPaid={handleMarkAsPaid}
        onOpenModal={openModal}
      />

      <PlannedFormModal
        isOpen={isOpen}
        editingItem={editingItem}
        categories={categories}
        onClose={closeModal}
        onSuccess={refresh}
      />
    </div>
  );
};
