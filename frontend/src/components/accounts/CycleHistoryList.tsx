import { CalendarClock, CheckCircle2, CircleDashed } from 'lucide-react';
import { useBillingCycles } from '../../hooks/useAccounts';
import { useFormatCurrency } from '../../hooks/useFormatCurrency';
import Skeleton from '../shared/Skeleton';

interface CycleHistoryListProps {
  accountId: string;
  enabled?: boolean;
  /** Mostra il paragrafo esplicativo sopra la lista (default true) */
  showIntro?: boolean;
  /** Giorno di addebito della carta: serve a stimare l'addebito del ciclo ancora aperto */
  billingDay?: number | null;
}

function fmtDate(d: string | Date) {
  return new Date(d).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
}

// Etichetta del ciclo = mese di chiusura (es. "Maggio 2026"), come un estratto conto.
function cycleMonthLabel(periodEnd: string) {
  const label = new Date(periodEnd).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

// Addebito stimato del ciclo aperto: il billingDay del mese successivo alla chiusura.
function projectedBilling(periodEnd: string, billingDay: number) {
  const e = new Date(periodEnd);
  return new Date(e.getFullYear(), e.getMonth() + 1, billingDay);
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
            const openBilling = isOpen && billingDay ? projectedBilling(c.periodEnd, billingDay) : null;
            return (
              <div key={c.id} className={`cycle-history-item${isOpen ? ' is-open' : ''}`}>
                <div className="cycle-history-item-head">
                  <span className="cycle-history-range">
                    <CalendarClock size={14} />
                    {cycleMonthLabel(c.periodEnd)}
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
                      Addebito {fmtDate(c.billingDate)}
                    </span>
                  )}
                  {isOpen && (
                    <span className="cycle-history-meta">
                      <CircleDashed size={13} />
                      Debito in accumulo{openBilling ? ` · da addebitare il ${fmtDate(openBilling)}` : ''}
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
