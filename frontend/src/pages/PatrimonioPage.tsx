import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, TrendingUp, TrendingDown, CreditCard, LineChart } from 'lucide-react';
import { useNetWorthSeries } from '../hooks/useDashboard';
import { useAccounts } from '../hooks/useAccounts';
import { useFormatCurrency } from '../hooks/useFormatCurrency';
import NetWorthChart from '../components/patrimonio/NetWorthChart';
import CompositionDonut from '../components/patrimonio/CompositionDonut';
import SavingsFlow from '../components/patrimonio/SavingsFlow';
import CategoryPieWidget from '../components/dashboard/widgets/CategoryPieWidget';
import { SkeletonChart } from '../components/shared/Skeleton';
import { formatMonth } from '../utils/date';

const MONTH_OPTIONS = [6, 12, 24] as const;

export default function PatrimonioPage() {
  const { formatCurrency } = useFormatCurrency();
  const [months, setMonths] = useState<number>(12);

  const { data, isFetching } = useNetWorthSeries(months);
  const { data: accounts = [] } = useAccounts();

  // Esposizione CC (debito) — mostrata separata, mai sottratta dal patrimonio.
  const ccExposure = useMemo(
    () => accounts.filter((a) => a.type === 'CREDIT_CARD').reduce((s, a) => s + a.balance, 0),
    [accounts]
  );

  const current = data?.current ?? 0;
  const change = data?.change ?? 0;
  const changePct = data?.changePct ?? null;
  const isUp = change >= 0;

  // Statistiche chiave derivate dalla serie (nessuna matematica backend extra).
  const stats = useMemo(() => {
    const pts = data?.points ?? [];
    if (pts.length === 0) return null;
    const values = pts.map((p) => p.netWorth);
    const max = Math.max(...values);
    const min = Math.min(...values);
    const avg = values.reduce((s, v) => s + v, 0) / values.length;

    let best: { month: string; delta: number } | null = null;
    let worst: { month: string; delta: number } | null = null;
    for (let i = 1; i < pts.length; i++) {
      const delta = pts[i].netWorth - pts[i - 1].netWorth;
      if (!best || delta > best.delta) best = { month: pts[i].month, delta };
      if (!worst || delta < worst.delta) worst = { month: pts[i].month, delta };
    }
    return { max, min, avg, best, worst };
  }, [data]);

  return (
    <div className="container-custom">
      <div className="page-header">
        <div>
          <Link to="/dashboard" className="outlook-detail-link projection-back">
            <ArrowLeft size={14} />
            Torna alla dashboard
          </Link>
          <h1 className="page-header-title">Patrimonio</h1>
          <p className="page-header-subtitle">
            Quanto vali, dov'è il tuo denaro e come è cresciuto nel tempo
          </p>
        </div>
      </div>

      {/* ── Hero patrimonio ── */}
      <div className="patrimonio-hero">
        <div className="patrimonio-hero-main">
          <span className="patrimonio-hero-label">Liquidità totale</span>
          <span className="patrimonio-hero-value">{formatCurrency(current)}</span>
          <span className={`patrimonio-hero-change${isUp ? ' is-positive' : ' is-negative'}`}>
            {isUp ? <TrendingUp size={15} /> : <TrendingDown size={15} />}
            {isUp ? '+' : '−'}{formatCurrency(Math.abs(change))}
            {changePct !== null && <span className="patrimonio-hero-change-pct">({isUp ? '+' : ''}{changePct}%)</span>}
            <span className="patrimonio-hero-change-period">negli ultimi {months} mesi</span>
          </span>
        </div>
        {ccExposure < 0 && (
          <div className="patrimonio-hero-cc">
            <span className="patrimonio-hero-cc-icon"><CreditCard size={16} /></span>
            <div>
              <span className="patrimonio-hero-cc-label">Esposizione carte</span>
              <span className="patrimonio-hero-cc-value">{formatCurrency(ccExposure)}</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Andamento nel tempo ── */}
      <div className="card">
        <div className="widget-head">
          <h3 className="widget-title">Andamento del patrimonio</h3>
          <div className="projection-pills">
            {MONTH_OPTIONS.map((m) => (
              <button
                key={m}
                onClick={() => setMonths(m)}
                className={`projection-pill${months === m ? ' is-active' : ''}`}
              >
                {m}M
              </button>
            ))}
          </div>
        </div>
        {isFetching && !data ? (
          <SkeletonChart />
        ) : !data || data.points.length < 2 ? (
          <div className="dashboard-chart-empty">Dati insufficienti per tracciare l'andamento</div>
        ) : (
          <NetWorthChart points={data.points} height={300} />
        )}
      </div>

      {/* ── Statistiche chiave ── */}
      {stats && (
        <div className="patrimonio-stats">
          <div className="patrimonio-stat">
            <span className="patrimonio-stat-label"><LineChart size={14} /> Patrimonio medio</span>
            <span className="patrimonio-stat-value">{formatCurrency(stats.avg)}</span>
          </div>
          <div className="patrimonio-stat">
            <span className="patrimonio-stat-label">Massimo</span>
            <span className="patrimonio-stat-value">{formatCurrency(stats.max)}</span>
          </div>
          <div className="patrimonio-stat">
            <span className="patrimonio-stat-label">Minimo</span>
            <span className="patrimonio-stat-value">{formatCurrency(stats.min)}</span>
          </div>
          {stats.best && (
            <div className="patrimonio-stat">
              <span className="patrimonio-stat-label">Mese migliore</span>
              <span className="patrimonio-stat-value is-positive">+{formatCurrency(Math.abs(stats.best.delta))}</span>
              <span className="patrimonio-stat-meta">{formatMonth(stats.best.month + '-01')}</span>
            </div>
          )}
          {stats.worst && (
            <div className="patrimonio-stat">
              <span className="patrimonio-stat-label">Mese peggiore</span>
              <span className="patrimonio-stat-value is-negative">−{formatCurrency(Math.abs(stats.worst.delta))}</span>
              <span className="patrimonio-stat-meta">{formatMonth(stats.worst.month + '-01')}</span>
            </div>
          )}
        </div>
      )}

      {/* ── Composizione + Risparmio ── */}
      <div className="patrimonio-grid">
        <CompositionDonut />
        <SavingsFlow months={months} />
      </div>

      {/* ── Spese per categoria (riuso widget autonomo) ── */}
      <CategoryPieWidget />
    </div>
  );
}
