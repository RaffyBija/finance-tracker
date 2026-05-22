import { useState } from "react";
import {
  usePlannedTransactions,
  useDeletePlanned,
  useMarkAsPaid,
} from "../hooks/usePlannedTransactions";
import { useFormModal } from "../hooks/useFormModal";
import { useDeleteConfirm } from "../hooks/useDeleteConfirm";
import PageHeader from "../components/shared/PageHeader";
import {
  SkeletonPageHeader,
  SkeletonList,
} from "../components/shared/Skeleton";
import PlannedFilters from "../components/planned/PlannedFilters";
import PlannedList from "../components/planned/PlannedList";
import PlannedFormModal from "../components/planned/PlannedFormModal";
import PlannedMarkAsPaidModal from "../components/planned/PlannedMarkAsPaidModal";
import type { PlannedTransaction } from "../types";
import { useToast } from "../contexts/ToastContext";

export const PlannedTransactions = () => {
  const { planned, categories, isLoading, filterStatus, setFilterStatus } =
    usePlannedTransactions();
  const deleteMutation = useDeletePlanned();
  const markAsPaidMutation = useMarkAsPaid();
  const { isOpen, editingItem, openModal, openEditModal, closeModal } =
    useFormModal<PlannedTransaction>();
  const { confirmDelete } = useDeleteConfirm();
  const [markingPaidItem, setMarkingPaidItem] = useState<PlannedTransaction | null>(null);

  const toast = useToast();

  const handleDelete = async (id: string) => {
    if (!confirmDelete("Sei sicuro di voler eliminare questa spesa pianificata?")) return;
    try {
      await deleteMutation.mutateAsync(id);
      toast.success("Spesa pianificata eliminata");
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
          <PageHeader
            title="Pianificati"
            actionLabel="Nuova voce pianificata"
            onAction={openModal}
          />
          <PlannedFilters
            filterStatus={filterStatus}
            setFilterStatus={setFilterStatus}
          />
          <PlannedList
            planned={planned}
            onEdit={openEditModal}
            onDelete={handleDelete}
            onMarkAsPaid={setMarkingPaidItem}
            onOpenModal={openModal}
          />
        </>
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
    </div>
  );
};
