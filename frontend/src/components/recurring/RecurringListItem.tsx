import { Trash2, Pencil, TrendingUp, TrendingDown, Power, Calendar, PlayCircle } from 'lucide-react';
import { formatDateShort } from '../../utils/date';
import type { RecurringTransaction, Frequency, RecurringDueItem } from '../../types';
import { useFormatCurrency } from '../../hooks/useFormatCurrency';

interface RecurringListItemProps {
  recurring: RecurringTransaction;
  dueItem?: RecurringDueItem;
  onEdit: (recurring: RecurringTransaction) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string) => void;
  onRequestExecute?: (dueItem: RecurringDueItem) => void;
}

/**
 * Singolo item della lista transazioni ricorrenti
 */
export default function RecurringListItem({
  recurring,
  dueItem,
  onEdit,
  onDelete,
  onToggle,
  onRequestExecute,
}: RecurringListItemProps) {
  const { formatSignedCurrency } = useFormatCurrency();
  const getFrequencyLabel = (freq: Frequency, dayOfMonth?: number) => {
    switch (freq) {
      case 'WEEKLY':
        return 'Settimanale';
      case 'MONTHLY':
        return `Ogni ${dayOfMonth} del mese`;
      case 'YEARLY':
        return 'Annuale';
      default:
        return freq;
    }
  };

  const handleCardClick = () => {
    if (!onRequestExecute) return;
    if (dueItem) {
      onRequestExecute(dueItem);
    } else if (recurring.isActive) {
      onRequestExecute({ ...recurring, nextDueDate: '', daysOverdue: -1 });
    }
  };

  const cardClass = dueItem
    ? 'list-card-item list-card-item-due'
    : recurring.isActive
    ? 'list-card-item list-card-item-executable'
    : 'list-card-item';

  return (
    <div className={cardClass} onClick={handleCardClick}>
      <div className="list-item-row is-center">
        <div className="list-item-main is-center">
          <div className={recurring.type === 'INCOME' ? 'tx-list-icon-income' : 'tx-list-icon-expense'}>
            {recurring.type === 'INCOME' ? (
              <TrendingUp className="icon-lg" />
            ) : (
              <TrendingDown className="icon-lg" />
            )}
          </div>
          <div className="list-item-body">
            <div className="list-item-title-row">
              <h3 className="list-item-title">{recurring.description}</h3>
              <span
                className={`${
                  recurring.isActive ? 'badge-status-active' : 'badge-status-inactive'
                }`}
              >
                {recurring.isActive ? 'Attivo' : 'Inattivo'}
              </span>
              {dueItem ? (
                <span className={`recurring-due-indicator${dueItem.daysOverdue > 0 ? ' recurring-due-indicator-overdue' : ''}`}>
                  {dueItem.daysOverdue > 0 ? `⚠ ${dueItem.daysOverdue}g fa` : '⚡ da eseguire'}
                </span>
              ) : recurring.isActive && (
                <span className="recurring-due-indicator recurring-due-indicator-manual">
                  <PlayCircle className="icon-xs" /> registra ora
                </span>
              )}
            </div>
            <div className="list-item-meta-row">
              <span>{recurring.category?.name || 'Senza categoria'}</span>
              <span>•</span>
              <div className="list-item-meta-inline">
                <Calendar className="icon-sm" />
                {getFrequencyLabel(recurring.frequency, recurring.dayOfMonth)}
              </div>
            </div>
            <p className="list-item-date-hint">
              Dal {formatDateShort(recurring.startDate)}
              {recurring.endDate && ` al ${formatDateShort(recurring.endDate)}`}
            </p>
          </div>
        </div>

        <div className="list-item-actions">
          <span
            className={`list-item-amount ${
              recurring.type === 'INCOME' ? 'is-income' : 'is-expense'
            }`}
          >
            {formatSignedCurrency(Number(recurring.amount), recurring.type)}
          </span>
          <div className="list-item-action-buttons" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => onToggle(recurring.id)}
              className={recurring.isActive ? 'btn-icon-success' : 'btn-icon-neutral'}
              title={recurring.isActive ? 'Disattiva ricorrente' : 'Attiva ricorrente'}
              aria-label={recurring.isActive ? 'Disattiva ricorrente' : 'Attiva ricorrente'}
            >
              <Power className="icon-md" />
            </button>
            <button onClick={() => onEdit(recurring)} className="btn-icon-primary" title="Modifica transazione ricorrente" aria-label="Modifica transazione ricorrente">
              <Pencil className="icon-sm" />
            </button>
            <button onClick={() => onDelete(recurring.id)} className="btn-icon-danger" title="Elimina transazione ricorrente" aria-label="Elimina transazione ricorrente">
              <Trash2 className="icon-sm" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
