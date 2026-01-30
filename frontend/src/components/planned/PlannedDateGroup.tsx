import { Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import type { PlannedTransaction } from '../../types';
import PlannedListItem from './PlannedListItem';

interface PlannedDateGroupProps {
  date: string;
  planned: PlannedTransaction[];
  badgeClassName: string;
  badgeText: string;
  onEdit: (planned: PlannedTransaction) => void;
  onDelete: (id: string) => void;
  onMarkAsPaid: (id: string) => void;
}

/**
 * Gruppo di transazioni pianificate per data
 */
export default function PlannedDateGroup({
  date,
  planned,
  badgeClassName,
  badgeText,
  onEdit,
  onDelete,
  onMarkAsPaid,
}: PlannedDateGroupProps) {
  return (
    <div className="card">
      <div className="card-header flex items-center gap-3">
        <Calendar className="icon-md text-neutral-600" />
        <span className="font-semibold text-neutral-900">
          {format(new Date(date), 'EEEE, dd MMMM yyyy', { locale: it })}
        </span>
        <span className={badgeClassName}>{badgeText}</span>
      </div>
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
