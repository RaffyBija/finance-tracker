import { useState } from "react";
import { Plus } from "lucide-react";
import {
  usePlannedTransactions,
  useSuspendedTransactions,
  useDeletePlanned,
} from "../hooks/usePlannedTransactions";
import { useCategories } from "../hooks/useCategories";
import { useFormModal } from "../hooks/useFormModal";
import PageHeader from "../components/shared/PageHeader";
import DueBanner from "../components/due/DueBanner";
import { useDueReview } from "../components/due/DueReviewProvider";
import { plannedToEntry, todayLocal } from "../components/due/dueEntries";
import { useAccounts } from "../hooks/useAccounts";
import {
  SkeletonPageHeader,
  SkeletonList,
} from "../components/shared/Skeleton";
import PlannedFilters from "../components/planned/PlannedFilters";
import PlannedList from "../components/planned/PlannedList";
import SuspendedList from "../components/planned/SuspendedList";
import PlannedFormModal from "../components/planned/PlannedFormModal";
import ConfirmModal from "../components/shared/ConfirmModal";
import type { PlannedTransaction } from "../types";
import { useToast } from "../contexts/ToastContext";

// "Segna come pagata" (pianificate, Sospesi, anche future) apre il popup unico
// "Scadenze da registrare" su quella voce: stessa UI e stessa scelta della data
// effettiva ovunque si registri una scadenza.
function useOpenPlannedRegistration() {
  const { openDueEntries } = useDueReview();
  const { data: accounts = [] } = useAccounts();
  return (item: PlannedTransaction) => openDueEntries([plannedToEntry(item, accounts, todayLocal())]);
}

export const PlannedTransactions = ({ embedded = false }: { embedded?: boolean } = {}) => {
  const { planned, categories, isLoading, filterStatus, setFilterStatus } =
    usePlannedTransactions();
  const deleteMutation = useDeletePlanned();
  const { isOpen, editingItem, openModal, openEditModal, closeModal } =
    useFormModal<PlannedTransaction>();
  const openMarkAsPaid = useOpenPlannedRegistration();
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
          <DueBanner kinds={['planned', 'cc']} noun={['pianificata', 'pianificate']} />
          <PlannedFilters
            filterStatus={filterStatus}
            setFilterStatus={setFilterStatus}
          />
          <PlannedList
            planned={planned}
            onEdit={openEditModal}
            onDelete={setDeletingId}
            onMarkAsPaid={openMarkAsPaid}
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
  const { isOpen, editingItem, openModal, openEditModal, closeModal } =
    useFormModal<PlannedTransaction>();
  const openMarkAsPaid = useOpenPlannedRegistration();
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
            onMarkAsPaid={openMarkAsPaid}
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
