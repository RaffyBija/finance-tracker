import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import BaseModal from '../layout/ModalBase';
import type { PlannedTransaction } from '../../types';
import { useFormatCurrency } from '../../hooks/useFormatCurrency';

interface PlannedMarkAsPaidModalProps {
  item: PlannedTransaction | null;
  isPending: boolean;
  onConfirm: (date?: string) => void;
  onClose: () => void;
}

export default function PlannedMarkAsPaidModal({
  item,
  isPending,
  onConfirm,
  onClose,
}: PlannedMarkAsPaidModalProps) {
  const { formatSignedCurrency } = useFormatCurrency();

  // Un Sospeso non ha una plannedDate da cui derivare la data della transazione:
  // va chiesta esplicitamente. Per le pianificate normali resta il flusso invariato.
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  useEffect(() => {
    if (item) setDate(new Date().toISOString().split('T')[0]);
  }, [item?.id]);

  if (!item) return null;

  const isIncome = item.type === 'INCOME';
  const isSuspended = item.plannedDate == null;

  return (
    <BaseModal isOpen={!!item} title="Segna come pagata" onClose={onClose}>
      <div className="modal-form">
        <p className="recurring-due-subtitle">
          Vuoi segnare questa transazione pianificata come pagata?
        </p>

        <div className="recurring-due-item" style={{ cursor: 'default', pointerEvents: 'none' }}>
          <div className={isIncome ? 'transaction-card-icon-income' : 'transaction-card-icon-expense'}>
            {isIncome
              ? <TrendingUp className="icon-sm" />
              : <TrendingDown className="icon-sm" />
            }
          </div>
          <div className="recurring-due-info">
            <p className="recurring-due-name">{item.description}</p>
            <p className="recurring-due-category">{item.category?.name || 'Senza categoria'}</p>
          </div>
          <div className="recurring-due-right">
            <span className={isIncome ? 'transaction-card-amount-income' : 'transaction-card-amount-expense'}>
              {formatSignedCurrency(Number(item.amount), item.type)}
            </span>
          </div>
        </div>

        {isSuspended && (
          <div className="form-group">
            <label className="form-label form-label-required">Data della transazione</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="form-input"
            />
            <p className="form-help">Era un sospeso senza data: indicala ora.</p>
          </div>
        )}

        <div className="form-actions">
          <button type="button" onClick={onClose} className="btn btn-ghost btn-md btn-cancel" disabled={isPending}>
            Annulla
          </button>
          <button
            type="button"
            onClick={() => onConfirm(isSuspended ? date : undefined)}
            disabled={isPending || (isSuspended && !date)}
            className="btn btn-primary btn-md"
          >
            {isPending ? 'Salvataggio...' : 'Conferma'}
          </button>
        </div>
      </div>
    </BaseModal>
  );
}
