import type { RecurringTransaction, RecurringDueItem } from '../../types';
import EmptyState from '../shared/EmptyState';
import RecurringListItem from './RecurringListItem';

interface RecurringListProps {
  recurring: RecurringTransaction[];
  dueItems?: RecurringDueItem[];
  onEdit: (recurring: RecurringTransaction) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string) => void;
  onRequestExecute?: (dueItem: RecurringDueItem) => void;
  onOpenModal: () => void;
}

export default function RecurringList({
  recurring,
  dueItems = [],
  onEdit,
  onDelete,
  onToggle,
  onRequestExecute,
  onOpenModal,
}: RecurringListProps) {
  const dueMap = new Map(dueItems.map((d) => [d.id, d]));

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
          dueItem={dueMap.get(rec.id)}
          onEdit={onEdit}
          onDelete={onDelete}
          onToggle={onToggle}
          onRequestExecute={onRequestExecute}
        />
      ))}
    </div>
  );
}
