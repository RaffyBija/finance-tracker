import { useState } from "react";
import {
  useRecurringTransactions,
  useDeleteRecurring,
  useToggleRecurring,
  useExecuteRecurring,
  useExecuteRecurringNow,
} from "../hooks/useRecurringTransactions";
import { useFormModal } from "../hooks/useFormModal";
import { useDeleteConfirm } from "../hooks/useDeleteConfirm";
import { usePending } from "../contexts/PendingContext";
import PageHeader from "../components/shared/PageHeader";
import {
  SkeletonPageHeader,
  SkeletonList,
} from "../components/shared/Skeleton";
import RecurringList from "../components/recurring/RecurringList";
import RecurringDueSection from "../components/recurring/RecurringDueSection";
import RecurringExecuteModal from "../components/recurring/RecurringExecuteModal";
import RecurringFormModal from "../components/recurring/RecurringFormModal";
import type { RecurringTransaction, RecurringDueItem } from "../types";
import { useToast } from "../contexts/ToastContext";

export const RecurringTransactions = () => {
  const { recurring, categories, isLoading } = useRecurringTransactions();
  const { recurringDueData } = usePending();
  const deleteMutation = useDeleteRecurring();
  const toggleMutation = useToggleRecurring();
  const executeMutation = useExecuteRecurring();
  const executeNowMutation = useExecuteRecurringNow();
  const { isOpen, editingItem, openModal, openEditModal, closeModal } =
    useFormModal<RecurringTransaction>();
  const { confirmDelete } = useDeleteConfirm();
  const toast = useToast();

  const [executingItem, setExecutingItem] = useState<RecurringDueItem | null>(null);

  const dueItems = recurringDueData
    ? [...recurringDueData.dueToday, ...recurringDueData.overdue]
    : [];

  const handleDelete = async (id: string) => {
    if (!confirmDelete("Sei sicuro di voler eliminare questa spesa ricorrente?")) return;
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

  const handleConfirmExecute = async () => {
    if (!executingItem) return;
    try {
      if (executingItem.daysOverdue === -1) {
        await executeNowMutation.mutateAsync(executingItem.id);
      } else {
        await executeMutation.mutateAsync([executingItem.id]);
      }
      toast.success("Transazione registrata con successo");
      setExecutingItem(null);
    } catch {
      toast.error("Errore nella registrazione");
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
            title="Ricorrenti"
            actionLabel="Nuova voce ricorrente"
            onAction={openModal}
          />
          <RecurringDueSection />
          <RecurringList
            recurring={recurring}
            dueItems={dueItems}
            onEdit={openEditModal}
            onDelete={handleDelete}
            onToggle={handleToggle}
            onRequestExecute={setExecutingItem}
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

      <RecurringExecuteModal
        item={executingItem}
        isPending={executeMutation.isPending || executeNowMutation.isPending}
        onConfirm={handleConfirmExecute}
        onClose={() => setExecutingItem(null)}
      />
    </div>
  );
};
