import { Check } from 'lucide-react';
import { useFormatCurrency } from '../../hooks/useFormatCurrency';
import { directionMeta, rataStatus, rataShortLabel } from './planMeta';
import type { InstallmentRata, PlanDirection } from '../../types';

interface Props {
  installments: InstallmentRata[];
  direction: PlanDirection;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onPayOne: (id: string) => void;
}

export default function InstallmentRataList({
  installments,
  direction,
  selectedIds,
  onToggleSelect,
  onPayOne,
}: Props) {
  const { formatCurrency } = useFormatCurrency();
  const meta = directionMeta(direction);

  return (
    <ul className="plan-rate-list">
      {installments.map((r) => {
        const status = rataStatus(r, meta.verbPast);
        return (
          <li key={r.id} className={`plan-rate-row${r.isPaid ? ' is-paid' : ''}`}>
            {r.isPaid ? (
              <span className="plan-rate-check plan-rate-check--done" aria-hidden="true">
                <Check size={14} />
              </span>
            ) : (
              <input
                type="checkbox"
                className="plan-rate-check"
                checked={selectedIds.has(r.id)}
                onChange={() => onToggleSelect(r.id)}
                aria-label={`Seleziona rata ${rataShortLabel(r)}`}
              />
            )}

            <div className="plan-rate-main">
              <span className="plan-rate-desc">{rataShortLabel(r)}</span>
              <span className={`plan-rate-badge ${status.cls}`}>{status.text}</span>
            </div>

            <span className="plan-rate-amount">{formatCurrency(Number(r.amount))}</span>

            {!r.isPaid && (
              <button
                type="button"
                className="btn btn-ghost btn-sm plan-rate-pay"
                onClick={() => onPayOne(r.id)}
              >
                {meta.verb}
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
