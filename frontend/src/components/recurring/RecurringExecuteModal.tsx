import { TrendingUp, TrendingDown } from 'lucide-react';
import BaseModal from '../layout/ModalBase';
import type { RecurringDueItem } from '../../types';

interface RecurringExecuteModalProps {
  item: RecurringDueItem | null;
  isPending: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export default function RecurringExecuteModal({
  item,
  isPending,
  onConfirm,
  onClose,
}: RecurringExecuteModalProps) {
  if (!item) return null;

  const isIncome = item.type === 'INCOME';

  return (
    <BaseModal isOpen={!!item} title="Registra transazione" onClose={onClose}>
      <div className="modal-form">
        <p className="recurring-due-subtitle">
          Vuoi registrare questa transazione ricorrente?
        </p>

        <div className="recurring-due-item" style={{ cursor: 'default', pointerEvents: 'none' }}>
          <div className={isIncome ? 'transaction-card-icon-income flex-shrink-0' : 'transaction-card-icon-expense flex-shrink-0'}>
            {isIncome
              ? <TrendingUp className="icon-sm text-success-600" />
              : <TrendingDown className="icon-sm text-danger-600" />
            }
          </div>
          <div className="recurring-due-info">
            <p className="recurring-due-name">{item.description}</p>
            <p className="recurring-due-category">{item.category?.name || 'Senza categoria'}</p>
          </div>
          <div className="recurring-due-right">
            <span className={isIncome ? 'transaction-card-amount-income' : 'transaction-card-amount-expense'}>
              {isIncome ? '+' : '−'}€{Number(item.amount).toFixed(2)}
            </span>
            {item.daysOverdue > 0
              ? <span className="recurring-due-badge recurring-due-badge-overdue">⚠ {item.daysOverdue}g fa</span>
              : <span className="recurring-due-badge recurring-due-badge-today">oggi</span>
            }
          </div>
        </div>

        <div className="form-actions">
          <button type="button" onClick={onClose} className="btn btn-ghost btn-md" disabled={isPending}>
            Annulla
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="btn btn-primary btn-md"
          >
            {isPending ? 'Registrazione...' : 'Registra'}
          </button>
        </div>
      </div>
    </BaseModal>
  );
}
