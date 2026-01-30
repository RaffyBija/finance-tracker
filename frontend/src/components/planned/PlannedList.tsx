import { isPast, isToday, isTomorrow } from 'date-fns';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import type { PlannedTransaction } from '../../types';
import EmptyState from '../shared/EmptyState';
import PlannedDateGroup from './PlannedDateGroup';

interface PlannedListProps {
  planned: PlannedTransaction[];
  onEdit: (planned: PlannedTransaction) => void;
  onDelete: (id: string) => void;
  onMarkAsPaid: (id: string) => void;
  onOpenModal: () => void;
}

/**
 * Lista completa delle transazioni pianificate raggruppate per data
 */
export default function PlannedList({
  planned,
  onEdit,
  onDelete,
  onMarkAsPaid,
  onOpenModal,
}: PlannedListProps) {
  // Helper per badge data
  const getDateBadge = (date: string) => {
    const d = new Date(date);
    if (isToday(d)) return { text: 'Oggi', className: 'badge-date-today' };
    if (isTomorrow(d)) return { text: 'Domani', className: 'badge-date-tomorrow' };
    if (isPast(d)) return { text: 'Scaduto', className: 'badge-date-past' };
    return {
      text: format(d, 'dd MMM yyyy', { locale: it }),
      className: 'badge-date-upcoming',
    };
  };

  // Raggruppa per data
  const groupedPlanned = planned.reduce((groups, p) => {
    const date = p.plannedDate.split('T')[0];
    if (!groups[date]) groups[date] = [];
    groups[date].push(p);
    return groups;
  }, {} as Record<string, PlannedTransaction[]>);

  const sortedDates = Object.keys(groupedPlanned).sort();

  if (sortedDates.length === 0) {
    return (
      <EmptyState
        title="Nessuna spesa pianificata trovata"
        description="Crea la tua prima spesa pianificata per organizzare i pagamenti futuri"
        actionLabel="Crea Spesa Pianificata"
        onAction={onOpenModal}
      />
    );
  }

  return (
    <div className="space-y-6">
      {sortedDates.map((date) => {
        const badge = getDateBadge(date);
        return (
          <PlannedDateGroup
            key={date}
            date={date}
            planned={groupedPlanned[date]}
            badgeClassName={badge.className}
            badgeText={badge.text}
            onEdit={onEdit}
            onDelete={onDelete}
            onMarkAsPaid={onMarkAsPaid}
          />
        );
      })}
    </div>
  );
}
