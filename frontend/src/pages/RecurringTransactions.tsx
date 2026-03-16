import { useRecurringTransactions, useDeleteRecurring, useToggleRecurring } from '../hooks/useRecurringTransactions';
import { useFormModal } from '../hooks/useFormModal';
import { useDeleteConfirm } from '../hooks/useDeleteConfirm';
import PageHeader from '../components/shared/PageHeader';
import { SkeletonPageHeader, SkeletonList } from '../components/shared/Skeleton';
import RecurringList from '../components/recurring/RecurringList';
import RecurringFormModal from '../components/recurring/RecurringFormModal';
import type { RecurringTransaction } from '../types';

export const RecurringTransactions = () => {
  const { recurring, categories, isLoading } = useRecurringTransactions();
  const deleteMutation = useDeleteRecurring();
  const toggleMutation = useToggleRecurring();
  const { isOpen, editingItem, openModal, openEditModal, closeModal } = useFormModal<RecurringTransaction>();
  const { confirmDelete } = useDeleteConfirm();

  const handleDelete = async (id: string) => {
    if (!confirmDelete('Sei sicuro di voler eliminare questa spesa ricorrente?')) return;
    await deleteMutation.mutateAsync(id);
  };

  const handleToggle = async (id: string) => {
    await toggleMutation.mutateAsync(id);
  };

  return (
    <div className="container-custom">
      {isLoading ? (
        <>
          <SkeletonPageHeader />
          <SkeletonList rows={6} />
        </>
      ) : (
        <>
          <PageHeader title="Spese Ricorrenti" actionLabel="Nuova Spesa Ricorrente" onAction={openModal} />
          <RecurringList
            recurring={recurring}
            onEdit={openEditModal}
            onDelete={handleDelete}
            onToggle={handleToggle}
            onOpenModal={openModal}
          />
        </>
      )}

      <RecurringFormModal
        isOpen={isOpen}
        editingItem={editingItem}
        categories={categories}
        onClose={closeModal}
        onSuccess={() => {}}
      />
    </div>
  );
};