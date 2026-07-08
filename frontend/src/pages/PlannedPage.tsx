import { useState } from "react";
import { Plus } from "lucide-react";
import {
  usePlannedTransactions,
  useSuspendedTransactions,
  useDeletePlanned,
  useMarkAsPaid,
} from "../hooks/usePlannedTransactions";
import { useCategories } from "../hooks/useCategories";
import { useFormModal } from "../hooks/useFormModal";
import PageHeader from "../components/shared/PageHeader";
import {
  SkeletonPageHeader,
  SkeletonList,
} from "../components/shared/Skeleton";
import PlannedFilters from "../components/planned/PlannedFilters";
import PlannedList from "../components/planned/PlannedList";
import SuspendedList from "../components/planned/SuspendedList";
import PlannedFormModal from "../components/planned/PlannedFormModal";
import PlannedMarkAsPaidModal from "../components/planned/PlannedMarkAsPaidModal";
import ConfirmModal from "../components/shared/ConfirmModal";
import type { PlannedTransaction } from "../types";
import { useToast } from "../contexts/ToastContext";

export const PlannedTransactions = ({ embedded = false }: { embedded?: boolean } = {}) => {
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

  const handleConfirmMarkAsPaid = async (date?: string) => {
    if (!markingPaidItem) return;
    try {
      await markAsPaidMutation.mutateAsync({ id: markingPaidItem.id, date });
      toast.success("Segnata come pagata");
      setMarkingPaidItem(null);
    } catch {
      toast.error("Errore nel salvataggio");
    }
  };

  const body = (
    <>
      {isLoading ? (
        <>
          {!embedded && <SkeletonPageHeader />}
          <SkeletonList rows={5} />
        </>
      ) : (
        <>
          {!embedded && <PageHeader title="Pianificati" />}
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
    </>
  );

  return embedded ? body : <div className="container-custom">{body}</div>;
};

// Sospesi: pianificate senza data (importo noto, data ignota). Condivide con
// PlannedTransactions le mutation e i modal (form, mark-as-paid, delete),
// cambia solo la fonte dati e la lista (flat, senza raggruppamento per data).
export const SuspendedTransactions = ({ embedded = false }: { embedded?: boolean } = {}) => {
  const { data: planned = [], isLoading } = useSuspendedTransactions();
  const { data: categories = [] } = useCategories();
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
      toast.success("Sospeso eliminato");
      setDeletingId(null);
    } catch {
      toast.error("Errore nell'eliminazione");
    }
  };

  const handleConfirmMarkAsPaid = async (date?: string) => {
    if (!markingPaidItem) return;
    try {
      await markAsPaidMutation.mutateAsync({ id: markingPaidItem.id, date });
      toast.success("Segnata come pagata");
      setMarkingPaidItem(null);
    } catch {
      toast.error("Errore nel salvataggio");
    }
  };

  const body = (
    <>
      {isLoading ? (
        <>
          {!embedded && <SkeletonPageHeader />}
          <SkeletonList rows={5} />
        </>
      ) : (
        <>
          {!embedded && <PageHeader title="Sospesi" />}
          <SuspendedList
            planned={planned}
            onEdit={openEditModal}
            onDelete={setDeletingId}
            onMarkAsPaid={setMarkingPaidItem}
            onOpenModal={openModal}
          />
        </>
      )}

      {!isLoading && (
        <button className="fab" onClick={openModal} aria-label="Nuovo sospeso">
          <Plus size={22} />
          <span className="fab-label">Nuovo</span>
        </button>
      )}

      <PlannedFormModal
        isOpen={isOpen}
        editingItem={editingItem}
        categories={categories}
        onClose={closeModal}
        onSuccess={() => {}}
        defaultNoDate
      />

      <PlannedMarkAsPaidModal
        item={markingPaidItem}
        isPending={markAsPaidMutation.isPending}
        onConfirm={handleConfirmMarkAsPaid}
        onClose={() => setMarkingPaidItem(null)}
      />

      <ConfirmModal
        isOpen={!!deletingId}
        title="Elimina sospeso"
        message="Sei sicuro di voler eliminare questo sospeso? L'operazione non può essere annullata."
        confirmLabel="Elimina"
        isPending={deleteMutation.isPending}
        onConfirm={handleConfirmDelete}
        onClose={() => setDeletingId(null)}
      />
    </>
  );

  return embedded ? body : <div className="container-custom">{body}</div>;
};
