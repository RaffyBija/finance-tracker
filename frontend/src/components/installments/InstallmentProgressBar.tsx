import type { PlanDirection } from '../../types';

interface Props {
  paidCount: number;
  totalCount: number;
  direction: PlanDirection;
}

// Barra di avanzamento "X su Y" del piano a rate.
export default function InstallmentProgressBar({ paidCount, totalCount, direction }: Props) {
  const pct = totalCount > 0 ? Math.round((paidCount / totalCount) * 100) : 0;
  const tone = direction === 'CREDIT' ? 'credit' : 'debt';
  return (
    <div
      className="plan-progress"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={totalCount}
      aria-valuenow={paidCount}
      aria-label={`${paidCount} su ${totalCount} rate`}
    >
      <div className={`plan-progress-fill plan-progress-fill--${tone}`} style={{ width: `${pct}%` }} />
    </div>
  );
}
