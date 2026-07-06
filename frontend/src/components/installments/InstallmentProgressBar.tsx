import type { PlanDirection } from '../../types';

interface Props {
  paidCount: number;
  totalCount: number;
  paidAmount: number;
  totalAmount: number;
  direction: PlanDirection;
}

// Barra di avanzamento del piano: il riempimento misura l'IMPORTO saldato
// (le rate possono avere importi diversi), l'etichetta resta "X su Y" rate.
export default function InstallmentProgressBar({
  paidCount,
  totalCount,
  paidAmount,
  totalAmount,
  direction,
}: Props) {
  const pct = totalAmount > 0 ? Math.min(100, Math.round((paidAmount / totalAmount) * 100)) : 0;
  const tone = direction === 'CREDIT' ? 'credit' : 'debt';
  return (
    <div
      className="plan-progress"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      aria-label={`${paidCount} su ${totalCount} rate, ${pct}% dell'importo saldato`}
    >
      <div className={`plan-progress-fill plan-progress-fill--${tone}`} style={{ width: `${pct}%` }} />
    </div>
  );
}
