import type { RecurringTransaction } from '../../types';
import EmptyState from '../shared/EmptyState';
import RecurringListItem from './RecurringListItem';

interface RecurringListProps {
  recurring: RecurringTransaction[];
  onEdit: (recurring: RecurringTransaction) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string) => void;
  onOpenModal: () => void;
}

/**
 * Lista completa delle transazioni ricorrenti
 */
export default function RecurringList({
  recurring,
  onEdit,
  onDelete,
  onToggle,
  onOpenModal,
}: RecurringListProps) {
  if (recurring.length === 0) {
    return (
      <EmptyState
        title="Nessuna spesa ricorrente trovata"
        description="Crea la tua prima spesa ricorrente per monitorare entrate/uscite fisse"
        actionLabel="Crea Spesa Ricorrente"
        onAction={onOpenModal}
      />
    );
  }

  return (
    <div className="list-card">
      {recurring.map((rec) => (
        <RecurringListItem
          key={rec.id}
          recurring={rec}
          onEdit={onEdit}
          onDelete={onDelete}
          onToggle={onToggle}
        />
      ))}
    </div>
  );
}
