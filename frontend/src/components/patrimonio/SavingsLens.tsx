import { useMemo } from 'react';
import { useMonthlyTrend } from '../../hooks/useDashboard';
import { useFormatCurrency } from '../../hooks/useFormatCurrency';
import SavingsFlow from './SavingsFlow';
import { formatMonth } from '../../utils/date';
import { toneOf, signOf } from './tone';

// Lente "Risparmio & flussi": il grafico entrate/uscite (SavingsFlow) + metriche
// complementari (medie mensili, mese di risparmio migliore/peggiore). Il
// "risparmiato nel periodo" e il tasso restano dentro SavingsFlow, qui niente doppioni.

interface SavingsLensProps {
  months: number;
}

export default function SavingsLens({ months }: SavingsLensProps) {
  const { data: trend = [] } = useMonthlyTrend(months);
  const { formatCurrency } = useFormatCurrency();

  const metrics = useMemo(() => {
    if (trend.length === 0) return null;
    // getMonthlyTrend emette un bucket solo per i mesi CON movimenti: dividere per
    // trend.length gonfierebbe le medie per chi ha mesi vuoti nell'orizzonte. La
    // media "al mese" deve usare l'orizzonte selezionato (defensivo: max coi bucket).
    const denom = Math.max(months, trend.length);
    const avgIncome = trend.reduce((s, t) => s + t.income, 0) / denom;
    const avgExpense = trend.reduce((s, t) => s + t.expense, 0) / denom;

    let best: { month: string; saved: number } | null = null;
    let worst: { month: string; saved: number } | null = null;
    for (const t of trend) {
      const saved = t.income - t.expense;
      if (!best || saved > best.saved) best = { month: t.month, saved };
      if (!worst || saved < worst.saved) worst = { month: t.month, saved };
    }
    const hasVariance = !!best && !!worst && best.saved !== worst.saved;
    return { avgIncome, avgExpense, best, worst, hasVariance };
  }, [trend, months]);

  return (
    <div className="lens-stack">
      <SavingsFlow months={months} />

      {metrics && (
        <div className="patrimonio-stats">
          <div className="patrimonio-stat">
            <span className="patrimonio-stat-label">Entrata media</span>
            <span className="patrimonio-stat-value">{formatCurrency(metrics.avgIncome)}</span>
            <span className="patrimonio-stat-meta">al mese</span>
          </div>
          <div className="patrimonio-stat">
            <span className="patrimonio-stat-label">Uscita media</span>
            <span className="patrimonio-stat-value">{formatCurrency(metrics.avgExpense)}</span>
            <span className="patrimonio-stat-meta">al mese</span>
          </div>
          {metrics.hasVariance && metrics.best && (
            <div className="patrimonio-stat">
              <span className="patrimonio-stat-label">Mese più ricco</span>
              <span className={`patrimonio-stat-value is-${toneOf(metrics.best.saved)}`}>
                {signOf(metrics.best.saved)}{formatCurrency(Math.abs(metrics.best.saved))}
              </span>
              <span className="patrimonio-stat-meta">{formatMonth(metrics.best.month + '-01')}</span>
            </div>
          )}
          {metrics.hasVariance && metrics.worst && (
            <div className="patrimonio-stat">
              <span className="patrimonio-stat-label">Mese più magro</span>
              <span className={`patrimonio-stat-value is-${toneOf(metrics.worst.saved)}`}>
                {signOf(metrics.worst.saved)}{formatCurrency(Math.abs(metrics.worst.saved))}
              </span>
              <span className="patrimonio-stat-meta">{formatMonth(metrics.worst.month + '-01')}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
