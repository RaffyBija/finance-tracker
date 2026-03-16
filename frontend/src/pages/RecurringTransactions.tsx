import {
  useRecurringTransactions,
  useDeleteRecurring,
  useToggleRecurring,
} from "../hooks/useRecurringTransactions";
import { useFormModal } from "../hooks/useFormModal";
import { useDeleteConfirm } from "../hooks/useDeleteConfirm";
import PageHeader from "../components/shared/PageHeader";
import {
  SkeletonPageHeader,
  SkeletonList,
} from "../components/shared/Skeleton";
import RecurringList from "../components/recurring/RecurringList";
import RecurringFormModal from "../components/recurring/RecurringFormModal";
import type { RecurringTransaction } from "../types";
import { useToast } from "../contexts/ToastContext";

export const RecurringTransactions = () => {
  const { recurring, categories, isLoading } = useRecurringTransactions();
  const deleteMutation = useDeleteRecurring();
  const toggleMutation = useToggleRecurring();
  const { isOpen, editingItem, openModal, openEditModal, closeModal } =
    useFormModal<RecurringTransaction>();
  const { confirmDelete } = useDeleteConfirm();

  const toast = useToast();

  const handleDelete = async (id: string) => {
    if (!confirmDelete("...")) return;
    try {
      await deleteMutation.mutateAsync(id);
      toast.success("Spesa ricorrente eliminata");
    } catch {
      toast.error("Errore nell'eliminazione");
    }
  };

  const handleToggle = async (id: string) => {
    try {
      await toggleMutation.mutateAsync(id);
      toast.success("Stato aggiornato");
    } catch {
      toast.error("Errore nel cambio stato");
    }
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
