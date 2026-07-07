import { useEffect, useMemo, useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import BaseModal from '../layout/ModalBase';
import { useFormatCurrency } from '../../hooks/useFormatCurrency';
import { formatDateShort } from '../../utils/date';
import { directionMeta } from './planMeta';
import InstallmentProgressBar from './InstallmentProgressBar';
import InstallmentRataList from './InstallmentRataList';
import type { InstallmentPlan } from '../../types';

interface Props {
  isOpen: boolean;
  plan: InstallmentPlan | null;
  onClose: () => void;
  onEdit: (plan: InstallmentPlan) => void;
  onDelete: (id: string) => void;
  onPay: (plan: InstallmentPlan, plannedIds: string[]) => void;
}

// Dettaglio del piano: qui vivono la lista rate, la selezione multipla e le
// azioni. Come BudgetDetailModal, ogni azione chiude il dettaglio e apre il
// modal dedicato (pagamento, modifica, conferma eliminazione).
export default function InstallmentPlanDetailModal({
  isOpen,
  plan,
  onClose,
  onEdit,
  onDelete,
  onPay,
}: Props) {
  const { formatCurrency } = useFormatCurrency();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Selezione pulita a ogni apertura; se il piano si aggiorna mentre il
  // dettaglio è aperto, tieni selezionate solo le rate ancora non pagate.
  useEffect(() => {
    if (!isOpen) return;
    setSelectedIds(new Set());
  }, [isOpen, plan?.id]);

  useEffect(() => {
    if (!plan) return;
    const unpaid = new Set(plan.installments.filter((r) => !r.isPaid).map((r) => r.id));
    setSelectedIds((prev) => {
      const next = new Set([...prev].filter((id) => unpaid.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [plan]);

  const selectedSum = useMemo(
    () =>
      plan
        ? plan.installments
            .filter((r) => selectedIds.has(r.id))
            .reduce((s, r) => s + Number(r.amount), 0)
        : 0,
    [plan, selectedIds],
  );

  if (!isOpen || !plan) return null;

  const meta = directionMeta(plan.direction);
  const { totalCount, paidCount, paidAmount, remainingAmount, nextDueDate } = plan.progress;

  const toggleSelect = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  return (
    <BaseModal isOpen={isOpen} title={plan.title} onClose={onClose}>
      <div className="plan-detail">
        <p className="plan-detail-sub">
          {meta.label} · {formatCurrency(Number(plan.totalAmount))}
          {plan.account ? ` · ${plan.account.name}` : ''}
        </p>

        <div className="plan-card-progressrow">
          <InstallmentProgressBar
            paidCount={paidCount}
            totalCount={totalCount}
            paidAmount={paidAmount}
            totalAmount={paidAmount + remainingAmount}
            direction={plan.direction}
          />
          <span className="plan-card-progresslabel">
            {paidCount} su {totalCount}
          </span>
        </div>

        <div className="plan-card-stats">
          <div className="plan-card-stat">
            <span className="plan-card-stat-label">
              {plan.direction === 'CREDIT' ? 'Da incassare' : 'Residuo'}
            </span>
            <span className="plan-card-stat-value">{formatCurrency(remainingAmount)}</span>
          </div>
          {nextDueDate && (
            <div className="plan-card-stat">
              <span className="plan-card-stat-label">Prossima scadenza</span>
              <span className="plan-card-stat-value">{formatDateShort(nextDueDate)}</span>
            </div>
          )}
        </div>

        {plan.notes && <p className="plan-detail-notes">{plan.notes}</p>}

        <InstallmentRataList
          installments={plan.installments}
          direction={plan.direction}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onPayOne={(id) => onPay(plan, [id])}
        />

        {selectedIds.size > 0 && (
          <div className="plan-pay-bar">
            <span className="plan-pay-bar-info">
              {selectedIds.size} {selectedIds.size === 1 ? 'rata' : 'rate'} ·{' '}
              {formatCurrency(selectedSum)}
            </span>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => onPay(plan, [...selectedIds])}
            >
              {meta.verb} selezionate
            </button>
          </div>
        )}

        <div className="form-actions">
          <button
            type="button"
            className="btn btn-ghost btn-md"
            onClick={() => onDelete(plan.id)}
          >
            <Trash2 className="icon-sm" /> Elimina
          </button>
          <button
            type="button"
            className="btn btn-primary btn-md"
            onClick={() => onEdit(plan)}
          >
            <Pencil className="icon-sm" /> Modifica
          </button>
        </div>
      </div>
    </BaseModal>
  );
}
