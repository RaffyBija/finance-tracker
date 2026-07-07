import { useEffect, useState } from 'react';
import BaseModal from '../layout/ModalBase';
import AccountSelector from '../accounts/AccountSelector';
import { useAccounts, useDefaultAccount } from '../../hooks/useAccounts';
import { useFormatCurrency } from '../../hooks/useFormatCurrency';
import { formatDayMonth } from '../../utils/date';
import { directionMeta, rataShortLabel } from './planMeta';
import type { InstallmentPlan, InstallmentRata } from '../../types';

interface Props {
  isOpen: boolean;
  plan: InstallmentPlan | null;
  rate: InstallmentRata[];
  isPending: boolean;
  onConfirm: (args: { accountId?: string; date: string }) => void;
  onClose: () => void;
}

const today = () => new Date().toISOString().split('T')[0];

export default function PayInstallmentsModal({
  isOpen,
  plan,
  rate,
  isPending,
  onConfirm,
  onClose,
}: Props) {
  const { data: accounts = [] } = useAccounts();
  const { data: defaultAccount } = useDefaultAccount();
  const { formatCurrency } = useFormatCurrency();

  const [accountId, setAccountId] = useState('');
  const [date, setDate] = useState(today());

  useEffect(() => {
    if (!isOpen) return;
    setAccountId(plan?.accountId ?? defaultAccount?.id ?? '');
    setDate(today());
  }, [isOpen, plan, defaultAccount]);

  if (!isOpen || !plan) return null;

  const meta = directionMeta(plan.direction);
  const total = rate.reduce((s, r) => s + Number(r.amount), 0);
  const isCredit = plan.direction === 'CREDIT';

  return (
    <BaseModal
      isOpen={isOpen}
      title={isCredit ? 'Registra incasso' : 'Paga rate'}
      onClose={onClose}
    >
      <div className="modal-form">
        <p className="pay-modal-intro">
          {rate.length === 1
            ? `Verrà creata una transazione per la rata di ${plan.title}.`
            : `Le ${rate.length} rate selezionate confluiranno in un'unica transazione.`}
        </p>

        <ul className="pay-modal-list">
          {rate.map((r) => (
            <li key={r.id} className="pay-modal-item">
              <span className="pay-modal-item-label">{rataShortLabel(r)}</span>
              <span className="pay-modal-item-date">{formatDayMonth(r.plannedDate)}</span>
              <span className="pay-modal-item-amount">{formatCurrency(Number(r.amount))}</span>
            </li>
          ))}
        </ul>

        <div className="pay-modal-total">
          <span>Totale</span>
          <span className="pay-modal-total-value">{formatCurrency(total)}</span>
        </div>

        <div className="form-group">
          <label className="form-label">Data</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="form-input"
          />
        </div>

        {accounts.length > 1 && (
          <AccountSelector
            accounts={accounts}
            value={accountId}
            onChange={setAccountId}
            label={isCredit ? 'Conto di accredito' : 'Conto di addebito'}
          />
        )}

        <div className="form-actions">
          <button type="button" onClick={onClose} className="btn btn-ghost btn-md btn-cancel">
            Annulla
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => onConfirm({ accountId: accountId || undefined, date })}
            className="btn btn-primary btn-md"
          >
            {isPending ? 'Registrazione...' : `${meta.verb} ${formatCurrency(total)}`}
          </button>
        </div>
      </div>
    </BaseModal>
  );
}
