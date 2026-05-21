import { CalendarClock, TrendingUp, TrendingDown } from 'lucide-react';
import { usePending } from '../../contexts/PendingContext';
import { useMarkAsPaid } from '../../hooks/usePlannedTransactions';
import { useToast } from '../../contexts/ToastContext';
import type { PlannedTransaction } from '../../types';

function DueItem({ item, onRegister, isPending }: {
  item: PlannedTransaction;
  onRegister: (id: string) => void;
  isPending: boolean;
}) {
  const isOverdue = new Date(item.plannedDate) < new Date(new Date().setHours(0, 0, 0, 0));
  const dateLabel = new Date(item.plannedDate).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });

  return (
    <div className="pending-section-item">
      <div className={item.type === 'INCOME' ? 'transaction-card-icon-income flex-shrink-0' : 'transaction-card-icon-expense flex-shrink-0'}>
        {item.type === 'INCOME'
          ? <TrendingUp className="icon-sm text-success-600" />
          : <TrendingDown className="icon-sm text-danger-600" />
        }
      </div>
      <div className="pending-section-info">
        <p className="pending-section-name">{item.description}</p>
        <div className="pending-section-meta">
          <span className="pending-section-category">{item.category?.name || 'Senza categoria'}</span>
          {isOverdue
            ? <span className="recurring-due-badge recurring-due-badge-overdue">⚠ {dateLabel}</span>
            : <span className="recurring-due-badge recurring-due-badge-today">oggi</span>
          }
        </div>
      </div>
      <div className="pending-section-right">
        <span className={`pending-section-amount ${item.type === 'INCOME' ? 'transaction-card-amount-income' : 'transaction-card-amount-expense'}`}>
          {item.type === 'INCOME' ? '+' : '−'}€{Number(item.amount).toFixed(2)}
        </span>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => onRegister(item.id)}
          disabled={isPending}
        >
          Registra
        </button>
      </div>
    </div>
  );
}

export default function PlannedDueSection() {
  const { plannedDueData, plannedDueCount } = usePending();
  const markAsPaidMutation = useMarkAsPaid();
  const toast = useToast();

  if (plannedDueCount === 0) return null;

  const handleRegister = async (id: string) => {
    try {
      await markAsPaidMutation.mutateAsync(id);
      toast.success('Transazione registrata con successo');
    } catch {
      toast.error('Errore nella registrazione');
    }
  };

  return (
    <div className="pending-section">
      <div className="pending-section-header">
        <span className="pending-section-title">
          <CalendarClock size={15} />
          Da registrare
          <span className="pending-section-count">{plannedDueCount}</span>
        </span>
      </div>
      <div className="pending-section-list">
        {plannedDueData.map((item) => (
          <DueItem
            key={item.id}
            item={item}
            onRegister={handleRegister}
            isPending={markAsPaidMutation.isPending}
          />
        ))}
      </div>
    </div>
  );
}
