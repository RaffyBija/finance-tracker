import { useState } from "react";
import { Plus } from "lucide-react";
import {
  usePlannedTransactions,
  useDeletePlanned,
  useMarkAsPaid,
} from "../hooks/usePlannedTransactions";
import { useFormModal } from "../hooks/useFormModal";
import PageHeader from "../components/shared/PageHeader";
import {
  SkeletonPageHeader,
  SkeletonList,
} from "../components/shared/Skeleton";
import PlannedFilters from "../components/planned/PlannedFilters";
import PlannedList from "../components/planned/PlannedList";
import PlannedFormModal from "../components/planned/PlannedFormModal";
import PlannedMarkAsPaidModal from "../components/planned/PlannedMarkAsPaidModal";
import ConfirmModal from "../components/shared/ConfirmModal";
import type { PlannedTransaction } from "../types";
import { useToast } from "../contexts/ToastContext";

export const PlannedTransactions = () => {
  const { planned, categories, isLoading, filterStatus, setFilterStatus } =
    usePlannedTransactions();
  const deleteMutation = useDeletePlanned();
  const markAsPaidMutation = useMarkAsPaid();
  const { isOpen, editingItem, openModal, openEditModal, closeModal } =
    useFormModal<PlannedTransaction>();
  const [markingPaidItem, setMarkingPaidItem] = useState<PlannedTransaction | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const toast = useToast();

  const handleConfirmDelete = async () => {
    if (!deletingId) return;
    try {
      await deleteMutation.mutateAsync(deletingId);
      toast.success("Spesa pianificata eliminata");
      setDeletingId(null);
    } catch {
      toast.error("Errore nell'eliminazione");
    }
  };

  const handleConfirmMarkAsPaid = async () => {
    if (!markingPaidItem) return;
    try {
      await markAsPaidMutation.mutateAsync(markingPaidItem.id);
      toast.success("Segnata come pagata");
      setMarkingPaidItem(null);
    } catch {
      toast.error("Errore nel salvataggio");
    }
  };

  return (
    <div className="container-custom">
      {isLoading ? (
        <>
          <SkeletonPageHeader />
          <SkeletonList rows={5} />
        </>
      ) : (
        <>
          <PageHeader title="Pianificati" />
          <PlannedFilters
            filterStatus={filterStatus}
            setFilterStatus={setFilterStatus}
          />
          <PlannedList
            planned={planned}
            onEdit={openEditModal}
            onDelete={setDeletingId}
            onMarkAsPaid={setMarkingPaidItem}
            onOpenModal={openModal}
          />
        </>
      )}

      {/* ── Floating Action Button ── */}
      {!isLoading && (
        <button className="fab" onClick={openModal} aria-label="Nuova pianificata">
          <Plus size={22} />
          <span className="fab-label">Nuova</span>
        </button>
      )}

      <PlannedFormModal
        isOpen={isOpen}
        editingItem={editingItem}
        categories={categories}
        onClose={closeModal}
        onSuccess={() => {}}
      />

      <PlannedMarkAsPaidModal
        item={markingPaidItem}
        isPending={markAsPaidMutation.isPending}
        onConfirm={handleConfirmMarkAsPaid}
        onClose={() => setMarkingPaidItem(null)}
      />

      <ConfirmModal
        isOpen={!!deletingId}
        title="Elimina pianificata"
        message="Sei sicuro di voler eliminare questa spesa pianificata? L'operazione non può essere annullata."
        confirmLabel="Elimina"
        isPending={deleteMutation.isPending}
        onConfirm={handleConfirmDelete}
        onClose={() => setDeletingId(null)}
      />
    </div>
  );
};
