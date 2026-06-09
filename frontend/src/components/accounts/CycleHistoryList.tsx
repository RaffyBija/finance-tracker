import { CalendarClock, CheckCircle2, CircleDashed } from 'lucide-react';
import { useBillingCycles } from '../../hooks/useAccounts';
import { useFormatCurrency } from '../../hooks/useFormatCurrency';
import Skeleton from '../shared/Skeleton';
import { formatDateLong, formatCycleMonth, cycleMidpoint } from '../../utils/date';

interface CycleHistoryListProps {
  accountId: string;
  enabled?: boolean;
  /** Mostra il paragrafo esplicativo sopra la lista (default true) */
  showIntro?: boolean;
  /** Giorno di addebito della carta: serve a stimare l'addebito del ciclo ancora aperto */
  billingDay?: number | null;
}

// Addebito stimato del ciclo aperto: il billingDay del mese successivo a quello
// di competenza. Basato sul punto medio del ciclo per non scavallare di mese nei
// fusi non-UTC (periodEnd è 23:59:59.999 UTC).
function projectedBilling(periodStart: string, periodEnd: string, billingDay: number) {
  const mid = cycleMidpoint(periodStart, periodEnd);
  const year = mid.getFullYear();
  const month = mid.getMonth() + 1; // mese successivo a quello di competenza
  const lastDay = new Date(year, month + 1, 0).getDate(); // clamping per mesi corti (es. billingDay 31 ad aprile → 30)
  return new Date(year, month, Math.min(billingDay, lastDay));
}

/** Lista riusabile dello storico cicli di fatturazione di una CC.
 *  Montata inline nella pagina dettaglio carta (/accounts/:id). */
export default function CycleHistoryList({ accountId, enabled = true, showIntro = true, billingDay }: CycleHistoryListProps) {
  const { formatCurrency } = useFormatCurrency();
  const { data: cycles = [], isLoading } = useBillingCycles(accountId, enabled);

  return (
    <>
      {showIntro && (
        <div className="cycle-history-intro">
          <p>Ogni spesa appartiene al ciclo della sua data. I cicli chiusi diventano addebiti pianificati.</p>
          <p>Il ciclo in corso è il debito che stai accumulando.</p>
        </div>
      )}

      {isLoading ? (
        <div className="cycle-history-list">
          {[0, 1].map((i) => (
            <div key={i} className="cycle-history-item">
              <div className="cycle-history-item-head">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <div className="cycle-history-item-body">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-3 w-40" />
              </div>
            </div>
          ))}
        </div>
      ) : cycles.length === 0 ? (
        <p className="cycle-history-state">Nessun ciclo registrato.</p>
      ) : (
        <div className="cycle-history-list">
          {cycles.map((c) => {
            const isOpen = c.status === 'OPEN';
            const paid = c.planned?.isPaid ?? false;
            const openBilling = isOpen && billingDay ? projectedBilling(c.periodStart, c.periodEnd, billingDay) : null;
            return (
              <div key={c.id} className={`cycle-history-item${isOpen ? ' is-open' : ''}`}>
                <div className="cycle-history-item-head">
                  <span className="cycle-history-range">
                    <CalendarClock size={14} />
                    {formatCycleMonth(c.periodStart, c.periodEnd)}
                  </span>
                  <span className={`badge ${isOpen ? 'badge-info' : paid ? 'badge-success' : 'badge-warning'}`}>
                    {isOpen ? 'In corso' : paid ? 'Pagato' : 'Da pagare'}
                  </span>
                </div>

                <div className="cycle-history-item-body">
                  <span className="cycle-history-amount">{formatCurrency(c.debtAmount)}</span>
                  {!isOpen && c.billingDate && (
                    <span className="cycle-history-meta">
                      {paid ? <CheckCircle2 size={13} /> : <CircleDashed size={13} />}
                      Addebito {formatDateLong(c.billingDate)}
                    </span>
                  )}
                  {isOpen && (
                    <span className="cycle-history-meta">
                      <CircleDashed size={13} />
                      Debito in accumulo{openBilling ? ` · da addebitare il ${formatDateLong(openBilling)}` : ''}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
