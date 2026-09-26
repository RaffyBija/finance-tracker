import { useState } from "react";
import { Plus } from "lucide-react";
import {
  useRecurringTransactions,
  useDeleteRecurring,
  useToggleRecurring,
  useExecuteRecurringNow,
} from "../hooks/useRecurringTransactions";
import { useFormModal } from "../hooks/useFormModal";
import { usePending } from "../contexts/PendingContext";
import PageHeader from "../components/shared/PageHeader";
import {
  SkeletonPageHeader,
  SkeletonList,
} from "../components/shared/Skeleton";
import RecurringList from "../components/recurring/RecurringList";
import DueBanner from "../components/due/DueBanner";
import { useDueReview } from "../components/due/DueReviewProvider";
import { recurringToEntry, todayLocal } from "../components/due/dueEntries";
import RecurringExecuteModal from "../components/recurring/RecurringExecuteModal";
import RecurringFormModal from "../components/recurring/RecurringFormModal";
import ConfirmModal from "../components/shared/ConfirmModal";
import type { RecurringTransaction, RecurringDueItem } from "../types";
import { useToast } from "../contexts/ToastContext";

export const RecurringTransactions = ({ embedded = false }: { embedded?: boolean } = {}) => {
  const { recurring, categories, isLoading } = useRecurringTransactions();
  const { recurringDueData } = usePending();
  const deleteMutation = useDeleteRecurring();
  const toggleMutation = useToggleRecurring();
  const { openDueEntries } = useDueReview();
  const executeNowMutation = useExecuteRecurringNow();
  const { isOpen, editingItem, openModal, openEditModal, closeModal } =
    useFormModal<RecurringTransaction>();
  const toast = useToast();

  const [executingItem, setExecutingItem] = useState<RecurringDueItem | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const dueItems = recurringDueData
    ? [...recurringDueData.dueToday, ...recurringDueData.overdue]
    : [];

  const handleConfirmDelete = async () => {
    if (!deletingId) return;
    try {
      await deleteMutation.mutateAsync(deletingId);
      toast.success("Spesa ricorrente eliminata");
      setDeletingId(null);
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
      await executeNowMutation.mutateAsync(executingItem.id);
      toast.success("Transazione registrata con successo");
      setExecutingItem(null);
    } catch {
      toast.error("Errore nella registrazione");
    }
  };

  const body = (
    <>
      {isLoading ? (
        <>
          {!embedded && <SkeletonPageHeader />}
          <SkeletonList rows={6} />
        </>
      ) : (
        <>
          {!embedded && <PageHeader title="Ricorrenti" />}
          <DueBanner kinds={['recurring']} noun={['ricorrente', 'ricorrenti']} />
          <RecurringList
            recurring={recurring}
            dueItems={dueItems}
            onEdit={openEditModal}
            onDelete={setDeletingId}
            onToggle={handleToggle}
            onRequestExecute={(item) =>
              // In scadenza → popup unico (data prevista correggibile);
              // anticipata (daysOverdue -1) → modal dedicato: registra oggi e salta la prossima.
              item.daysOverdue >= 0
                ? openDueEntries([recurringToEntry(item, todayLocal())])
                : setExecutingItem(item)
            }
            onOpenModal={openModal}
          />
        </>
      )}

      {/* ── Floating Action Button ── */}
      {!isLoading && (
        <button className="fab" onClick={openModal} aria-label="Nuova ricorrente">
          <Plus size={22} />
          <span className="fab-label">Nuova</span>
        </button>
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
        isPending={executeNowMutation.isPending}
        onConfirm={handleConfirmExecute}
        onClose={() => setExecutingItem(null)}
      />

      <ConfirmModal
        isOpen={!!deletingId}
        title="Elimina ricorrente"
        message="Sei sicuro di voler eliminare questa spesa ricorrente? L'operazione non può essere annullata."
        confirmLabel="Elimina"
        isPending={deleteMutation.isPending}
        onConfirm={handleConfirmDelete}
        onClose={() => setDeletingId(null)}
      />
    </>
  );

  return embedded ? body : <div className="container-custom">{body}</div>;
};
