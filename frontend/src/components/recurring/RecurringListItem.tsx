import { Trash2, Pencil, TrendingUp, TrendingDown, Power, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import type { RecurringTransaction, Frequency } from '../../types';

interface RecurringListItemProps {
  recurring: RecurringTransaction;
  onEdit: (recurring: RecurringTransaction) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string) => void;
}

/**
 * Singolo item della lista transazioni ricorrenti
 */
export default function RecurringListItem({
  recurring,
  onEdit,
  onDelete,
  onToggle,
}: RecurringListItemProps) {
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

  return (
    <div className="list-card-item">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-4 flex-1 min-w-0">
          <div
            className={`w-12 h-12 rounded-full flex-center flex-shrink-0 ${
              recurring.type === 'INCOME' ? 'bg-success-100' : 'bg-danger-100'
            }`}
          >
            {recurring.type === 'INCOME' ? (
              <TrendingUp className="icon-lg text-success-600" />
            ) : (
              <TrendingDown className="icon-lg text-danger-600" />
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
              Dal {format(new Date(recurring.startDate), 'dd MMM yyyy', { locale: it })}
              {recurring.endDate &&
                ` al ${format(new Date(recurring.endDate), 'dd MMM yyyy', {
                  locale: it,
                })}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4 flex-wrap sm:flex-nowrap">
          <span
            className={`text-xl font-bold whitespace-nowrap ${
              recurring.type === 'INCOME' ? 'text-success-600' : 'text-danger-600'
            }`}
          >
            {recurring.type === 'INCOME' ? '+' : '-'}€{Number(recurring.amount).toFixed(2)}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onToggle(recurring.id)}
              className={`btn-icon ${
                recurring.isActive ? 'text-success-600 hover:bg-success-50' : 'btn-icon-neutral'
              }`}
              title={recurring.isActive ? 'Disattiva' : 'Attiva'}
            >
              <Power className="icon-md" />
            </button>
            <button onClick={() => onEdit(recurring)} className="btn-icon-primary">
              <Pencil className="icon-sm" />
            </button>
            <button onClick={() => onDelete(recurring.id)} className="btn-icon-danger">
              <Trash2 className="icon-sm" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
