import { useEffect, useMemo, useState } from 'react';
import { Pencil, Trash2, ChevronDown } from 'lucide-react';
import { useFormatCurrency } from '../../hooks/useFormatCurrency';
import { formatDateShort } from '../../utils/date';
import { directionMeta } from './planMeta';
import InstallmentProgressBar from './InstallmentProgressBar';
import InstallmentRataList from './InstallmentRataList';
import type { InstallmentPlan } from '../../types';

interface Props {
  plan: InstallmentPlan;
  onEdit: (plan: InstallmentPlan) => void;
  onDelete: (id: string) => void;
  onPay: (plan: InstallmentPlan, plannedIds: string[]) => void;
}

export default function InstallmentPlanCard({ plan, onEdit, onDelete, onPay }: Props) {
  const { formatCurrency } = useFormatCurrency();
  const meta = directionMeta(plan.direction);
  const { Icon } = meta;
  const [expanded, setExpanded] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { totalCount, paidCount, paidAmount, remainingAmount, nextDueDate } = plan.progress;

  // Dopo un pagamento la lista si ricarica: rimuovi dalla selezione le rate
  // che non sono più "non pagate".
  useEffect(() => {
    const unpaid = new Set(plan.installments.filter((r) => !r.isPaid).map((r) => r.id));
    setSelectedIds((prev) => {
      const next = new Set([...prev].filter((id) => unpaid.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [plan.installments]);

  const toggleSelect = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const selectedSum = useMemo(
    () =>
      plan.installments
        .filter((r) => selectedIds.has(r.id))
        .reduce((s, r) => s + Number(r.amount), 0),
    [plan.installments, selectedIds],
  );

  return (
    <div className="card plan-card">
      <div className="plan-card-header">
        <div className="plan-card-titlewrap">
          <span className={`plan-card-icon plan-card-icon--${meta.tone}`}>
            <Icon size={16} />
          </span>
          <div className="plan-card-titletext">
            <h3 className="plan-card-title">{plan.title}</h3>
            <span className="plan-card-sub">
              {meta.label} · {formatCurrency(Number(plan.totalAmount))}
            </span>
          </div>
        </div>

        <div className="plan-card-header-actions">
          {plan.status === 'COMPLETED' && <span className="badge badge-success">Completato</span>}
          {plan.status === 'CANCELLED' && <span className="badge badge-neutral">Annullato</span>}
          <button
            type="button"
            className="btn-icon-neutral"
            onClick={() => onEdit(plan)}
            aria-label="Modifica piano"
          >
            <Pencil size={16} />
          </button>
          <button
            type="button"
            className="btn-icon-danger"
            onClick={() => onDelete(plan.id)}
            aria-label="Elimina piano"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

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
        <button
          type="button"
          className={`plan-card-expand${expanded ? ' is-open' : ''}`}
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
        >
          {expanded ? 'Nascondi rate' : 'Mostra rate'}
          <ChevronDown size={15} />
        </button>
      </div>

      {expanded && (
        <InstallmentRataList
          installments={plan.installments}
          direction={plan.direction}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onPayOne={(id) => onPay(plan, [id])}
        />
      )}

      {selectedIds.size > 0 && (
        <div className="plan-pay-bar">
          <span className="plan-pay-bar-info">
            {selectedIds.size} {selectedIds.size === 1 ? 'rata' : 'rate'} · {formatCurrency(selectedSum)}
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
    </div>
  );
}
