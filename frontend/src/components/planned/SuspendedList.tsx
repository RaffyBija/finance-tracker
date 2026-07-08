import type { PlannedTransaction } from '../../types';
import EmptyState from '../shared/EmptyState';
import PlannedListItem from './PlannedListItem';

interface SuspendedListProps {
  planned: PlannedTransaction[];
  onEdit: (planned: PlannedTransaction) => void;
  onDelete: (id: string) => void;
  onMarkAsPaid: (planned: PlannedTransaction) => void;
  onOpenModal: () => void;
}

/**
 * Lista flat dei Sospesi (pianificate senza data): nessun raggruppamento per
 * data, dato che per definizione non ne hanno una.
 */
export default function SuspendedList({
  planned,
  onEdit,
  onDelete,
  onMarkAsPaid,
  onOpenModal,
}: SuspendedListProps) {
  if (planned.length === 0) {
    return (
      <EmptyState
        title="Nessun sospeso"
        description="Registra un importo di cui conosci la cifra ma non ancora la data (es. un rimborso in arrivo)"
        actionLabel="Crea Sospeso"
        onAction={onOpenModal}
      />
    );
  }

  return (
    <div className="card">
      <div className="card-divided">
        {planned.map((p) => (
          <PlannedListItem
            key={p.id}
            planned={p}
            onEdit={onEdit}
            onDelete={onDelete}
            onMarkAsPaid={onMarkAsPaid}
          />
        ))}
      </div>
    </div>
  );
}
