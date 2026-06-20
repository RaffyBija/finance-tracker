import { useMemo, memo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { useMonthlyTrend } from '../../hooks/useDashboard';
import { formatMonthShort } from '../../utils/date';
import { useFormatCurrency } from '../../hooks/useFormatCurrency';
import { useTheme } from '../../contexts/ThemeContext';
import { SkeletonChart } from '../shared/Skeleton';

// Risparmio e flusso mensile: barre entrate/uscite + tasso di risparmio del periodo.

const SavingsTooltip = memo(({ active, payload, label }: any) => {
  const { formatCurrency } = useFormatCurrency();
  if (!active || !payload?.length) return null;
  return (
    <div className="card card-md dashboard-tooltip">
      <p className="dashboard-tooltip-label">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }} className="dashboard-tooltip-value">
          {p.name}: {formatCurrency(Number(p.value))}
        </p>
      ))}
    </div>
  );
});

interface SavingsFlowProps {
  months: number;
}

export default function SavingsFlow({ months }: SavingsFlowProps) {
  const { data: trend = [], isLoading } = useMonthlyTrend(months);
  const { formatCurrency, formatCurrencyAxis } = useFormatCurrency();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const gridColor = isDark ? '#44403c' : '#e7e5e4';
  const axisColor = isDark ? '#78716c' : '#a8a29e';

  const formatted = useMemo(
    () => trend.map((t) => ({ ...t, label: formatMonthShort(t.month + '-01') })),
    [trend]
  );

  // Aggregati del periodo per il tasso di risparmio.
  const { totalIncome, totalExpense, saved, rate } = useMemo(() => {
    const inc = trend.reduce((s, t) => s + t.income, 0);
    const exp = trend.reduce((s, t) => s + t.expense, 0);
    const sv = inc - exp;
    return { totalIncome: inc, totalExpense: exp, saved: sv, rate: inc > 0 ? (sv / inc) * 100 : null };
  }, [trend]);

  if (isLoading) return <SkeletonChart />;

  return (
    <div className="card">
      <div className="widget-head">
        <h3 className="widget-title">Risparmio e flusso mensile</h3>
        <div className="dashboard-chart-legend">
          <span className="dashboard-chart-legend-item">
            <span className="dashboard-chart-dot dashboard-chart-dot-income" /> Entrate
          </span>
          <span className="dashboard-chart-legend-item">
            <span className="dashboard-chart-dot dashboard-chart-dot-expense" /> Uscite
          </span>
        </div>
      </div>

      <div className="savings-stats">
        <div className="savings-stat">
          <span className="savings-stat-label">Risparmiato nel periodo</span>
          <span className={`savings-stat-value${saved > 0 ? ' is-positive' : saved < 0 ? ' is-negative' : ''}`}>
            {saved > 0 ? '+' : saved < 0 ? '−' : ''}{formatCurrency(Math.abs(saved))}
          </span>
        </div>
        <div className="savings-stat">
          <span className="savings-stat-label">Tasso di risparmio</span>
          <span className="savings-stat-value">{rate === null ? '—' : `${Math.round(rate)}%`}</span>
        </div>
        <div className="savings-stat savings-stat--wide">
          <span className="savings-stat-label">Entrate · Uscite</span>
          <span className="savings-stat-value savings-stat-muted">
            {formatCurrency(totalIncome)} · {formatCurrency(totalExpense)}
          </span>
        </div>
      </div>

      {formatted.length === 0 ? (
        <div className="dashboard-chart-empty">Nessun movimento nel periodo</div>
      ) : (
        <div className="savings-chart">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={formatted} barCategoryGap="30%" barGap={4} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: axisColor }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fontSize: 11, fill: axisColor }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => formatCurrencyAxis(Number(v))}
                width={56}
              />
              <Tooltip content={<SavingsTooltip />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
              <Bar dataKey="income" name="Entrate" fill="#10B981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expense" name="Uscite" fill="#EF4444" radius={[4, 4, 0, 0]} opacity={0.8} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <p className="savings-stats-note">
        Entrate meno uscite del periodo, carte incluse. Può differire dalla variazione della liquidità.
      </p>
    </div>
  );
}
