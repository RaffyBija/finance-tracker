import { useState } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import BaseModal from '../layout/ModalBase';
import { useExecuteRecurring } from '../../hooks/useRecurringTransactions';
import { useToast } from '../../contexts/ToastContext';
import type { RecurringDueResponse } from '../../types';
import { formatSignedCurrency } from '../../utils/format';

interface RecurringDueModalProps {
  isOpen: boolean;
  data: RecurringDueResponse | null;
  onDismiss: () => void;
}

export default function RecurringDueModal({ isOpen, data, onDismiss }: RecurringDueModalProps) {
  const allItems = data ? [...data.dueToday, ...data.overdue] : [];
  const [selected, setSelected] = useState<Set<string>>(() => new Set(allItems.map((i) => i.id)));
  const executeMutation = useExecuteRecurring();
  const toast = useToast();

  if (!isOpen || allItems.length === 0) return null;

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleCreate = async () => {
    try {
      const ids = Array.from(selected);
      const result = await executeMutation.mutateAsync(ids);
      const n = result.count;
      toast.success(`${n} transazion${n === 1 ? 'e creata' : 'i create'} con successo`);
      onDismiss();
    } catch {
      toast.error('Errore nella creazione delle transazioni');
    }
  };

  return (
    <BaseModal isOpen={isOpen} title="Transazioni ricorrenti" onClose={onDismiss}>
      <div className="recurring-due-modal">
        <p className="recurring-due-subtitle">
          {allItems.length} transazion{allItems.length === 1 ? 'e' : 'i'} in scadenza — seleziona quali creare
        </p>

        <div className="recurring-due-list">
          {allItems.map((item) => (
            <div
              key={item.id}
              className={`recurring-due-item${selected.has(item.id) ? ' is-selected' : ''}`}
              onClick={() => toggle(item.id)}
            >
              <input
                type="checkbox"
                checked={selected.has(item.id)}
                onChange={() => toggle(item.id)}
                onClick={(e) => e.stopPropagation()}
                className="recurring-due-checkbox"
              />
              <div className={item.type === 'INCOME' ? 'transaction-card-icon-income' : 'transaction-card-icon-expense'}>
                {item.type === 'INCOME'
                  ? <TrendingUp className="icon-sm" />
                  : <TrendingDown className="icon-sm" />
                }
              </div>
              <div className="recurring-due-info">
                <p className="recurring-due-name">{item.description}</p>
                <p className="recurring-due-category">{item.category?.name || 'Senza categoria'}</p>
              </div>
              <div className="recurring-due-right">
                <span className={item.type === 'INCOME' ? 'transaction-card-amount-income' : 'transaction-card-amount-expense'}>
                  {formatSignedCurrency(Number(item.amount), item.type)}
                </span>
                {item.daysOverdue > 0
                  ? <span className="recurring-due-badge recurring-due-badge-overdue">⚠ {item.daysOverdue}g fa</span>
                  : <span className="recurring-due-badge recurring-due-badge-today">oggi</span>
                }
              </div>
            </div>
          ))}
        </div>

        <div className="form-actions">
          <button type="button" onClick={onDismiss} className="btn btn-ghost btn-md">
            Salta oggi
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={selected.size === 0 || executeMutation.isPending}
            className="btn btn-primary btn-md"
          >
            {executeMutation.isPending
              ? 'Creazione...'
              : `Crea selezionate (${selected.size})`}
          </button>
        </div>
      </div>
    </BaseModal>
  );
}
