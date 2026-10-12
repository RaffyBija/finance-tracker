import { useMemo } from 'react';
import type { RecurringTransaction } from '../../types';
import { summarizeRecurring } from '../../utils/recurringSummary';
import { useFormatCurrency } from '../../hooks/useFormatCurrency';

const signed = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '');

/** Riepilogo mensile equivalente di TUTTE le ricorrenti attive (indipendente da filtri/ricerca). */
export default function RecurringSummaryCard({ recurring }: { recurring: RecurringTransaction[] }) {
  const { formatCurrency } = useFormatCurrency();
  const s = useMemo(() => summarizeRecurring(recurring), [recurring]);

  if (s.count === 0) return null;

  const netClass = s.net > 0 ? 'is-income' : s.net < 0 ? 'is-expense' : '';

  return (
    <section className="card recurring-summary" aria-label="Riepilogo ricorrenti attive">
      <div className="recurring-summary-title">Ricorrenti attive · equivalente al mese</div>
      <div className="recurring-summary-grid">
        <div className="recurring-summary-stat">
          <div className="recurring-summary-label">Entrate</div>
          <div className="recurring-summary-value is-income">{formatCurrency(s.income)}</div>
        </div>
        <div className="recurring-summary-stat">
          <div className="recurring-summary-label">Uscite</div>
          <div className="recurring-summary-value is-expense">{formatCurrency(s.expense)}</div>
        </div>
        <div className="recurring-summary-stat">
          <div className="recurring-summary-label">Saldo netto</div>
          <div className={`recurring-summary-value ${netClass}`}>
            {signed(s.net)}{formatCurrency(Math.abs(s.net))}
          </div>
        </div>
      </div>
      <div className="recurring-summary-foot">
        {s.count} {s.count === 1 ? 'voce attiva' : 'voci attive'} · {signed(s.netYearly)}
        {formatCurrency(Math.abs(s.netYearly))} all'anno
      </div>
    </section>
  );
}
