import { useState } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import BaseModal from '../layout/ModalBase';
import { InputDecimal } from '../layout/InputNumberDecimal';
import type { RecurringDueItem } from '../../types';
import { useFormatCurrency } from '../../hooks/useFormatCurrency';

interface RecurringExecuteModalProps {
  item: RecurringDueItem | null;
  isPending: boolean;
  /** amount: importo reale confermato (solo ricorrenti a importo variabile). */
  onConfirm: (amount?: number) => void;
  onClose: () => void;
}

export default function RecurringExecuteModal({
  item,
  isPending,
  onConfirm,
  onClose,
}: RecurringExecuteModalProps) {
  const { formatSignedCurrency } = useFormatCurrency();
  // Importo reale per le ricorrenti a importo variabile. Il chiamante monta il modal
  // con key={item.id} (e lo smonta a item null): ogni apertura riparte dalla stima.
  const [amount, setAmount] = useState<number | null>(null);
  if (!item) return null;
  const variable = !!item.isVariableAmount;
  const confirmedAmount = amount ?? Number(item.amount);

  const isIncome = item.type === 'INCOME';

  const isManual = item.daysOverdue === -1;

  return (
    <BaseModal isOpen={!!item} title="Registra transazione" onClose={onClose}>
      <div className="modal-form">
        <p className="recurring-due-subtitle">
          {isManual
            ? 'Vuoi registrare anticipatamente questa transazione ricorrente? La data di oggi verrà usata.'
            : 'Vuoi registrare questa transazione ricorrente?'}
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
              {variable && '~'}
              {formatSignedCurrency(Number(item.amount), item.type)}
            </span>
            {isManual
              ? <span className="recurring-due-badge recurring-due-badge-manual">anticipato</span>
              : item.daysOverdue > 0
              ? <span className="recurring-due-badge recurring-due-badge-overdue">⚠ {item.daysOverdue}g fa</span>
              : <span className="recurring-due-badge recurring-due-badge-today">oggi</span>
            }
          </div>
        </div>

        {variable && (
          <InputDecimal
            formData={{ amount: confirmedAmount }}
            setFormData={({ amount: v }) => setAmount(Number(v) || 0)}
            label={isIncome ? 'Importo ricevuto' : 'Importo pagato'}
            required
            invalid={!(confirmedAmount > 0)}
          />
        )}

        <div className="form-actions">
          <button type="button" onClick={onClose} className="btn btn-ghost btn-md btn-cancel" disabled={isPending}>
            Annulla
          </button>
          <button
            type="button"
            onClick={() => onConfirm(variable ? confirmedAmount : undefined)}
            disabled={isPending || (variable && !(confirmedAmount > 0))}
            className="btn btn-primary btn-md"
          >
            {isPending ? 'Registrazione...' : 'Registra'}
          </button>
        </div>
      </div>
    </BaseModal>
  );
}
