import { ChevronRight } from 'lucide-react';
import { useFormatCurrency } from '../../hooks/useFormatCurrency';
import { directionMeta, rataStatus } from './planMeta';
import InstallmentProgressBar from './InstallmentProgressBar';
import type { InstallmentPlan } from '../../types';

interface Props {
  plan: InstallmentPlan;
  onOpen: (plan: InstallmentPlan) => void;
}

// Card-riassunto del piano: titolo, avanzamento e prossima rata.
// La lista rate e le azioni vivono nel modal di dettaglio (click sulla card),
// stesso pattern delle card Budget → BudgetDetailModal.
export default function InstallmentPlanCard({ plan, onOpen }: Props) {
  const { formatCurrency } = useFormatCurrency();
  const meta = directionMeta(plan.direction);
  const { Icon } = meta;

  const { totalCount, paidCount, paidAmount, remainingAmount } = plan.progress;
  const nextRata = plan.installments.find((r) => !r.isPaid);
  const nextStatus = nextRata ? rataStatus(nextRata, meta.verbPast) : null;

  return (
    <div
      className="card plan-card plan-card-clickable"
      role="button"
      tabIndex={0}
      onClick={() => onOpen(plan)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen(plan);
        }
      }}
    >
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
        <div className="plan-card-header-right">
          {plan.status === 'COMPLETED' && <span className="badge badge-success">Completato</span>}
          {plan.status === 'CANCELLED' && <span className="badge badge-neutral">Annullato</span>}
          <ChevronRight size={18} className="plan-card-chevron" aria-hidden="true" />
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
        {nextRata && nextStatus && (
          <div className="plan-card-stat">
            <span className="plan-card-stat-label">
              {plan.direction === 'CREDIT' ? 'Prossimo incasso' : 'Prossima rata'}
            </span>
            <span className="plan-card-stat-value plan-card-next">
              {formatCurrency(Number(nextRata.amount))}
              <span className={`plan-rate-badge ${nextStatus.cls}`}>{nextStatus.text}</span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
