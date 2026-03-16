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

  const toast = useToast();

  const handleDelete = async (id: string) => {
    if (!confirmDelete("...")) return;
    try {
      await deleteMutation.mutateAsync(id);
      toast.success("Spesa pianificata eliminata");
    } catch {
      toast.error("Errore nell'eliminazione");
    }
  };

  const handleMarkAsPaid = async (id: string) => {
    if (!confirmDelete("...")) return;
    try {
      await markAsPaidMutation.mutateAsync(id);
      toast.success("Segnata come pagata");
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
            title="Spese Pianificate"
            actionLabel="Nuova Spesa Pianificata"
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
            onMarkAsPaid={handleMarkAsPaid}
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
    </div>
  );
};
