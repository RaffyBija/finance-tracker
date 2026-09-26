import { useState } from 'react';
import { useNetWorthNow } from '../../hooks/useAnalytics';
import { useNetWorthSeries } from '../../hooks/useDashboard';
import { useFormatCurrency } from '../../hooks/useFormatCurrency';
import TrendLens from '../patrimonio/TrendLens';
import CompositionDonut from '../patrimonio/CompositionDonut';
import { SkeletonCard } from '../shared/Skeleton';

// Scheda "Patrimonio": quanto possiedi davvero oggi e come è cambiato.
//   Patrimonio netto = liquidità + crediti da incassare − debiti ancora da pagare
//   (debito carte, rate residue, sospesi). La liquidità resta il riferimento
//   dell'andamento storico (ricostruito dai movimenti dei conti).

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso + 'T00:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' }) : null;

export default function NetWorthLens() {
  const { formatCurrency } = useFormatCurrency();
  const { data: now, isLoading } = useNetWorthNow();
  const [months, setMonths] = useState(12);
  const { data: series, isFetching } = useNetWorthSeries(months);

  const rows = now ? [
    { label: 'Liquidità sui conti', value: now.liquidity, sign: 1 },
    { label: 'Crediti da incassare (piani a rate)', value: now.credits, sign: 1 },
    { label: 'Entrate sospese', value: now.suspendedIn, sign: 1 },
    { label: 'Debito carte (ciclo aperto e addebiti da registrare)', value: now.ccDebt, sign: -1 },
    { label: 'Debiti residui (piani a rate)', value: now.debts, sign: -1 },
    { label: 'Uscite sospese', value: now.suspendedOut, sign: -1 },
  ].filter((r, i) => i === 0 || r.value !== 0) : [];

  return (
    <div className="lens-stack">
      {isLoading || !now ? <SkeletonCard /> : (
        <div className="card analysis-networth">
          <div className="analysis-networth-head">
            <span className="analysis-hero-label">Patrimonio netto oggi</span>
            <span className={`analysis-hero-value${now.netWorth < 0 ? ' is-negative' : ''}`}>
              {now.netWorth < 0 ? '−' : ''}{formatCurrency(Math.abs(now.netWorth))}
            </span>
            <span className="analysis-networth-note">Liquidità più quanto ti devono, meno quanto devi ancora pagare.</span>
          </div>
          <ul className="analysis-networth-rows">
            {rows.map((r) => (
              <li key={r.label} className="analysis-networth-row">
                <span>{r.label}</span>
                <span className={`analysis-networth-amount${r.sign < 0 ? ' is-negative' : ''}`}>
                  {r.sign < 0 ? '−' : '+'}{formatCurrency(Math.abs(r.value))}
                </span>
              </li>
            ))}
          </ul>

          {(now.debtPlans.length > 0 || now.creditPlans.length > 0) && (
            <div className="analysis-networth-plans">
              {now.debtPlans.length > 0 && (
                <div>
                  <span className="analysis-subtitle">Debiti a rate</span>
                  <ul>
                    {now.debtPlans.map((p) => (
                      <li key={p.id}>
                        <span className="analysis-drill-desc">{p.title}</span>
                        <span className="analysis-drill-kind">
                          {p.count} {p.count === 1 ? 'rata' : 'rate'}{p.nextDate ? ` · prossima ${fmtDate(p.nextDate)}` : ''}
                        </span>
                        <span className="analysis-drill-amount is-negative">−{formatCurrency(p.remaining)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {now.creditPlans.length > 0 && (
                <div>
                  <span className="analysis-subtitle">Crediti a rate</span>
                  <ul>
                    {now.creditPlans.map((p) => (
                      <li key={p.id}>
                        <span className="analysis-drill-desc">{p.title}</span>
                        <span className="analysis-drill-kind">
                          {p.count} {p.count === 1 ? 'rata' : 'rate'}{p.nextDate ? ` · prossima ${fmtDate(p.nextDate)}` : ''}
                        </span>
                        <span className="analysis-drill-amount is-positive">+{formatCurrency(p.remaining)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <TrendLens months={months} setMonths={setMonths} data={series} isFetching={isFetching} />
      <CompositionDonut />
    </div>
  );
}
