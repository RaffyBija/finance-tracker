import { Trash2, Pencil, TrendingUp, TrendingDown, CheckCircle2, StickyNote } from 'lucide-react';
import type { PlannedTransaction } from '../../types';

interface PlannedListItemProps {
  planned: PlannedTransaction;
  onEdit: (planned: PlannedTransaction) => void;
  onDelete: (id: string) => void;
  onMarkAsPaid: (id: string) => void;
}

/**
 * Singolo item della lista transazioni pianificate
 */
export default function PlannedListItem({
  planned,
  onEdit,
  onDelete,
  onMarkAsPaid,
}: PlannedListItemProps) {
  return (
    <div className="list-card-item">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex items-start gap-4 flex-1 min-w-0">
          <div
            className={`w-12 h-12 rounded-full flex-center flex-shrink-0 ${
              planned.type === 'INCOME' ? 'bg-success-100' : 'bg-danger-100'
            } ${planned.isPaid ? 'opacity-50' : ''}`}
          >
            {planned.type === 'INCOME' ? (
              <TrendingUp className="icon-lg text-success-600" />
            ) : (
              <TrendingDown className="icon-lg text-danger-600" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3
                className={`font-semibold text-lg truncate ${
                  planned.isPaid ? 'line-through text-neutral-400' : ''
                }`}
              >
                {planned.description}
              </h3>
              {planned.isPaid && <span className="badge-paid">Pagato</span>}
            </div>
            <p className="text-sm text-neutral-500">
              {planned.category?.name || 'Senza categoria'}
            </p>
            {planned.notes && (
              <div className="flex items-start gap-2 mt-2 text-sm text-neutral-600 bg-neutral-50 p-2 rounded">
                <StickyNote className="icon-sm mt-0.5 flex-shrink-0" />
                <p>{planned.notes}</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4 flex-wrap sm:flex-nowrap sm:ml-4">
          <span
            className={`text-xl font-bold whitespace-nowrap ${
              planned.type === 'INCOME' ? 'text-success-600' : 'text-danger-600'
            } ${planned.isPaid ? 'line-through text-neutral-400' : ''}`}
          >
            {planned.type === 'INCOME' ? '+' : '-'}€{Number(planned.amount).toFixed(2)}
          </span>
          <div className="flex items-center gap-2">
            {!planned.isPaid && (
              <button
                onClick={() => onMarkAsPaid(planned.id)}
                className="btn-icon text-success-600 hover:bg-success-50"
                title="Segna come pagato"
              >
                <CheckCircle2 className="icon-md" />
              </button>
            )}
            <button onClick={() => onEdit(planned)} className="btn-icon-primary">
              <Pencil className="icon-sm" />
            </button>
            <button onClick={() => onDelete(planned.id)} className="btn-icon-danger">
              <Trash2 className="icon-sm" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
