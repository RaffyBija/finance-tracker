import { Trash2, Pencil, TrendingUp, TrendingDown, CheckCircle2, StickyNote } from 'lucide-react';
import type { PlannedTransaction } from '../../types';
import { useFormatCurrency } from '../../hooks/useFormatCurrency';

interface PlannedListItemProps {
  planned: PlannedTransaction;
  onEdit: (planned: PlannedTransaction) => void;
  onDelete: (id: string) => void;
  onMarkAsPaid: (planned: PlannedTransaction) => void;
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
  const { formatSignedCurrency } = useFormatCurrency();
  return (
    <div className="list-card-item">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex items-start gap-4 flex-1 min-w-0">
          <div
            className={`${planned.type === 'INCOME' ? 'tx-list-icon-income' : 'tx-list-icon-expense'}${planned.isPaid ? ' opacity-50' : ''}`}
          >
            {planned.type === 'INCOME' ? (
              <TrendingUp className="icon-lg" />
            ) : (
              <TrendingDown className="icon-lg" />
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
            {formatSignedCurrency(Number(planned.amount), planned.type)}
          </span>
          <div className="flex items-center gap-2">
            {!planned.isPaid && (
              <button
                onClick={() => onMarkAsPaid(planned)}
                className="btn-icon text-success-600 hover:bg-success-50"
                title="Segna come pagato"
                aria-label="Segna come pagato"
              >
                <CheckCircle2 className="icon-md" />
              </button>
            )}
            <button onClick={() => onEdit(planned)} className="btn-icon-primary" title="Modifica transazione pianificata" aria-label="Modifica transazione pianificata">
              <Pencil className="icon-sm" />
            </button>
            <button onClick={() => onDelete(planned.id)} className="btn-icon-danger" title="Elimina transazione pianificata" aria-label="Elimina transazione pianificata">
              <Trash2 className="icon-sm" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
