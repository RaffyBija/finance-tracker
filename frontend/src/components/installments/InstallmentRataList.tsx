import { isPast, isToday, isTomorrow } from 'date-fns';
import { Check } from 'lucide-react';
import { formatDayMonth } from '../../utils/date';
import { useFormatCurrency } from '../../hooks/useFormatCurrency';
import { directionMeta } from './planMeta';
import type { InstallmentRata, PlanDirection } from '../../types';

interface Props {
  installments: InstallmentRata[];
  direction: PlanDirection;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onPayOne: (id: string) => void;
}

// Stato di una rata: pagata / oggi / scaduta / domani / data futura.
function rataStatus(r: InstallmentRata, verbPast: string) {
  if (r.isPaid) return { text: verbPast, cls: 'plan-rate-badge--paid' };
  const d = new Date(r.plannedDate);
  if (isToday(d)) return { text: 'Oggi', cls: 'plan-rate-badge--today' };
  if (isPast(d)) return { text: 'Scaduta', cls: 'plan-rate-badge--overdue' };
  if (isTomorrow(d)) return { text: 'Domani', cls: 'plan-rate-badge--soon' };
  return { text: formatDayMonth(d), cls: 'plan-rate-badge--upcoming' };
}

// Etichetta breve della rata dentro la card (il titolo del piano è già nell'header):
// controparte se presente, altrimenti la parte dopo "— " della descrizione.
const shortLabel = (r: InstallmentRata) =>
  r.counterparty?.trim() || r.description.split(' — ').slice(1).join(' — ') || r.description;

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
                aria-label={`Seleziona rata ${shortLabel(r)}`}
              />
            )}

            <div className="plan-rate-main">
              <span className="plan-rate-desc">{shortLabel(r)}</span>
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
