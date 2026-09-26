import { useMemo, useState } from 'react';
import type { NetWorthSeries } from '../../types';
import { useNetWorthByAccount } from '../../hooks/useDashboard';
import { useFormatCurrency } from '../../hooks/useFormatCurrency';
import NetWorthChart from './NetWorthChart';
import NetWorthByAccountChart from './NetWorthByAccountChart';
import { SkeletonChart } from '../shared/Skeleton';
import { formatMonth } from '../../utils/date';
import { toneOf, signOf } from './tone';

const MONTH_OPTIONS = [6, 12, 24] as const;

interface TrendLensProps {
  months: number;
  setMonths: (m: number) => void;
  data?: NetWorthSeries;
  isFetching: boolean;
}

export default function TrendLens({ months, setMonths, data, isFetching }: TrendLensProps) {
  const { formatCurrency, formatPercent } = useFormatCurrency();
  const [byAccount, setByAccount] = useState(false);

  const { data: byAcc, isFetching: byAccFetching } = useNetWorthByAccount(months, byAccount);

  // Statistiche derivate dalla serie (nessuna matematica backend extra).
  const stats = useMemo(() => {
    const all = data?.points ?? [];
    // I mesi iniziali a zero precedono la creazione dei conti (nessun dato):
    // le statistiche partono dal primo mese con liquidità, altrimenti la
    // "crescita" sarebbe misurata da zero e il mese peggiore sarebbe un mese vuoto.
    const firstIdx = all.findIndex((p) => p.netWorth !== 0);
    const pts = firstIdx <= 0 ? all : all.slice(firstIdx);
    if (pts.length === 0) return null;
    const values = pts.map((p) => p.netWorth);

    const change = values[values.length - 1] - values[0];
    const changePct = values[0] !== 0 ? (change / Math.abs(values[0])) * 100 : null;
    const monthsCovered = pts.length - 1;
    // Variazione media mensile sul periodo con dati.
    const avgMonthly = monthsCovered > 0 ? change / monthsCovered : 0;

    // Drawdown massimo: peggiore calo da un picco precedente (€ e %).
    // La % è espressa solo se il picco è > 0: con picco ≤ 0 il rapporto perde
    // significato (segno invertito), quindi la sopprimiamo (null).
    let peak = values[0];
    let maxDrawdown = 0;
    let maxDrawdownPct: number | null = null;
    for (const v of values) {
      if (v > peak) peak = v;
      const dd = v - peak; // ≤ 0
      if (dd < maxDrawdown) {
        maxDrawdown = dd;
        maxDrawdownPct = peak > 0 ? (dd / peak) * 100 : null;
      }
    }

    // Mese migliore/peggiore: solo mesi CHIUSI (l'ultimo punto è il mese in
    // corso, incompleto) e solo con varianza reale.
    let best: { month: string; delta: number } | null = null;
    let worst: { month: string; delta: number } | null = null;
    for (let i = 1; i < pts.length - 1; i++) {
      const delta = pts[i].netWorth - pts[i - 1].netWorth;
      if (!best || delta > best.delta) best = { month: pts[i].month, delta };
      if (!worst || delta < worst.delta) worst = { month: pts[i].month, delta };
    }
    const hasVariance = !!best && !!worst && best.delta !== worst.delta;

    return {
      change, changePct, monthsCovered, fromMonth: pts[0].month, trimmed: firstIdx > 0,
      avgMonthly, maxDrawdown, maxDrawdownPct,
      best: hasVariance ? best : null,
      worst: hasVariance ? worst : null,
    };
  }, [data]);

  const change = stats?.change ?? 0;
  const changePct = stats?.changePct ?? null;

  return (
    <div className="lens-stack">
      <div className="card">
        <div className="widget-head widget-head--wrap">
          <h3 className="widget-title">Andamento della liquidità</h3>
          <div className="lens-toolbar">
            <div className="projection-pills" role="group" aria-label="Vista">
              <button
                type="button"
                onClick={() => setByAccount(false)}
                className={`projection-pill${!byAccount ? ' is-active' : ''}`}
                aria-pressed={!byAccount}
              >
                Totale
              </button>
              <button
                type="button"
                onClick={() => setByAccount(true)}
                className={`projection-pill${byAccount ? ' is-active' : ''}`}
                aria-pressed={byAccount}
              >
                Per conto
              </button>
            </div>
            <div className="projection-pills" role="group" aria-label="Orizzonte temporale">
              {MONTH_OPTIONS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMonths(m)}
                  className={`projection-pill${months === m ? ' is-active' : ''}`}
                  aria-pressed={months === m}
                >
                  {m}M
                </button>
              ))}
            </div>
          </div>
        </div>

        {byAccount ? (
          byAccFetching && !byAcc ? (
            <SkeletonChart />
          ) : !byAcc || byAcc.accounts.length === 0 || byAcc.months.length < 2 ? (
            <div className="dashboard-chart-empty">Dati insufficienti per scomporre l'andamento</div>
          ) : (
            <NetWorthByAccountChart data={byAcc} height={300} />
          )
        ) : isFetching && !data ? (
          <SkeletonChart />
        ) : !data || data.points.length < 2 ? (
          <div className="dashboard-chart-empty">Dati insufficienti per tracciare l'andamento</div>
        ) : (
          <NetWorthChart points={data.points} height={300} />
        )}
      </div>

      {stats && (
        <div className="patrimonio-stats">
          <div className="patrimonio-stat">
            <span className="patrimonio-stat-label">Crescita totale</span>
            <span className={`patrimonio-stat-value is-${toneOf(change)}`}>
              {signOf(change)}{formatCurrency(Math.abs(change))}
            </span>
            <span className="patrimonio-stat-meta">
              {stats?.trimmed
                ? `da ${formatMonth(stats.fromMonth + '-01')}${changePct !== null ? ` (${signOf(changePct)}${formatPercent(Math.abs(changePct))}%)` : ''}`
                : changePct !== null
                  ? `${signOf(changePct)}${formatPercent(Math.abs(changePct))}% in ${months} mesi`
                  : `ultimi ${months} mesi`}
            </span>
          </div>
          <div className="patrimonio-stat">
            <span className="patrimonio-stat-label">Variazione media</span>
            <span className={`patrimonio-stat-value is-${toneOf(stats.avgMonthly)}`}>
              {signOf(stats.avgMonthly)}{formatCurrency(Math.abs(stats.avgMonthly))}
            </span>
            <span className="patrimonio-stat-meta">al mese</span>
          </div>
          <div className="patrimonio-stat">
            <span className="patrimonio-stat-label">Calo massimo</span>
            <span className={`patrimonio-stat-value is-${stats.maxDrawdown < 0 ? 'negative' : 'neutral'}`}>
              {stats.maxDrawdown < 0 ? '−' : ''}{formatCurrency(Math.abs(stats.maxDrawdown))}
            </span>
            <span className="patrimonio-stat-meta">
              {stats.maxDrawdown < 0
                ? (stats.maxDrawdownPct !== null
                    ? `${formatPercent(Math.abs(stats.maxDrawdownPct))}% dal picco`
                    : 'dal picco precedente')
                : 'nessun calo'}
            </span>
          </div>
          {stats.best && (
            <div className="patrimonio-stat">
              <span className="patrimonio-stat-label">Mese migliore</span>
              <span className={`patrimonio-stat-value is-${toneOf(stats.best.delta)}`}>
                {signOf(stats.best.delta)}{formatCurrency(Math.abs(stats.best.delta))}
              </span>
              <span className="patrimonio-stat-meta">{formatMonth(stats.best.month + '-01')}</span>
            </div>
          )}
          {stats.worst && (
            <div className="patrimonio-stat">
              <span className="patrimonio-stat-label">Mese peggiore</span>
              <span className={`patrimonio-stat-value is-${toneOf(stats.worst.delta)}`}>
                {signOf(stats.worst.delta)}{formatCurrency(Math.abs(stats.worst.delta))}
              </span>
              <span className="patrimonio-stat-meta">{formatMonth(stats.worst.month + '-01')}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
