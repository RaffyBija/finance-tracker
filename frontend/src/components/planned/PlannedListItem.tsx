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
      <div className="list-item-row">
        <div className="list-item-main">
          <div
            className={`${planned.type === 'INCOME' ? 'tx-list-icon-income' : 'tx-list-icon-expense'}${planned.isPaid ? ' list-item-icon-paid' : ''}`}
          >
            {planned.type === 'INCOME' ? (
              <TrendingUp className="icon-lg" />
            ) : (
              <TrendingDown className="icon-lg" />
            )}
          </div>
          <div className="list-item-body">
            <div className="list-item-title-row">
              <h3 className={`list-item-title${planned.isPaid ? ' is-paid' : ''}`}>
                {planned.description}
              </h3>
              {planned.isPaid && <span className="badge-paid">Pagato</span>}
            </div>
            <p className="list-item-subtitle">
              {planned.category?.name || 'Senza categoria'}
            </p>
            {planned.notes && (
              <div className="list-item-note">
                <StickyNote className="icon-sm" />
                <p>{planned.notes}</p>
              </div>
            )}
          </div>
        </div>

        <div className="list-item-actions is-offset">
          <span
            className={`list-item-amount ${
              planned.type === 'INCOME' ? 'is-income' : 'is-expense'
            }${planned.isPaid ? ' is-paid' : ''}`}
          >
            {formatSignedCurrency(Number(planned.amount), planned.type)}
          </span>
          <div className="list-item-action-buttons">
            {!planned.isPaid && (
              <button
                onClick={() => onMarkAsPaid(planned)}
                className="btn-icon-success"
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
