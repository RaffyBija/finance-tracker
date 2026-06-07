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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-4 flex-1 min-w-0">
          <div className={recurring.type === 'INCOME' ? 'tx-list-icon-income' : 'tx-list-icon-expense'}>
            {recurring.type === 'INCOME' ? (
              <TrendingUp className="icon-lg" />
            ) : (
              <TrendingDown className="icon-lg" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-lg truncate">{recurring.description}</h3>
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
            <div className="flex flex-wrap items-center gap-2 text-sm text-neutral-500 mt-1">
              <span>{recurring.category?.name || 'Senza categoria'}</span>
              <span>•</span>
              <div className="flex items-center gap-1">
                <Calendar className="icon-sm" />
                {getFrequencyLabel(recurring.frequency, recurring.dayOfMonth)}
              </div>
            </div>
            <p className="text-xs text-neutral-400 mt-1">
              Dal {formatDateShort(recurring.startDate)}
              {recurring.endDate && ` al ${formatDateShort(recurring.endDate)}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4 flex-wrap sm:flex-nowrap">
          <span
            className={`text-xl font-bold whitespace-nowrap ${
              recurring.type === 'INCOME' ? 'text-success-600' : 'text-danger-600'
            }`}
          >
            {formatSignedCurrency(Number(recurring.amount), recurring.type)}
          </span>
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => onToggle(recurring.id)}
              className={`btn-icon ${
                recurring.isActive ? 'text-success-600 hover:bg-success-50' : 'btn-icon-neutral'
              }`}
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
