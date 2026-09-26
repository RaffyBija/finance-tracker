import { Zap } from 'lucide-react';
import { usePending } from '../../contexts/PendingContext';
import { useDueReview } from './DueReviewProvider';
import type { DueKind } from './dueEntries';

interface DueBannerProps {
  /** Tipi di scadenza che questa lista mostra (es. Pianificate = pianificate + addebiti carta). */
  kinds: DueKind[];
  /** Etichetta al singolare e al plurale, es. ['pianificata', 'pianificate']. */
  noun: [string, string];
}

/**
 * Banner compatto "N da registrare" in testa a una lista dello Scadenzario.
 * Non duplica la lista: apre il popup unico filtrato sul tipo della lista
 * (stessa UI, stessa scelta della data effettiva).
 */
export default function DueBanner({ kinds, noun }: DueBannerProps) {
  const { recurringDueCount, plannedDueData, installmentDueCount } = usePending();
  const { openDueReview } = useDueReview();

  const ccCount = plannedDueData.filter((p) => p.ccAccountId).length;
  const counts: Record<DueKind, number> = {
    recurring: recurringDueCount,
    planned: plannedDueData.length - ccCount,
    cc: ccCount,
    installment: installmentDueCount,
  };
  const count = kinds.reduce((sum, k) => sum + counts[k], 0);
  if (count === 0) return null;

  return (
    <div className="pending-banner">
      <span className="pending-banner-label">
        <Zap size={14} />
        {count} {count === 1 ? noun[0] : noun[1]} da registrare
      </span>
      <button type="button" className="btn btn-primary btn-sm" onClick={() => openDueReview(kinds)}>
        Rivedi e registra
      </button>
    </div>
  );
}
