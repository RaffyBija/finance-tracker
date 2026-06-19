import { useMemo, memo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { useMonthlyTrend } from '../../../hooks/useDashboard';
import { formatMonthShort } from '../../../utils/date';
import { useFormatCurrency } from '../../../hooks/useFormatCurrency';
import { SkeletonChart } from '../../shared/Skeleton';

const CustomBarTooltip = memo(({ active, payload, label }: any) => {
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

// Widget "Trend mensile" — barre entrate/uscite degli ultimi 6 mesi.
export default function MonthlyTrendWidget() {
  const { data: monthlyTrend = [], isLoading } = useMonthlyTrend(6);

  const formattedTrend = useMemo(
    () => monthlyTrend.map((item) => ({ ...item, month: formatMonthShort(item.month + '-01') })),
    [monthlyTrend]
  );

  if (isLoading) return <SkeletonChart />;

  return (
    <div className="card card-lg">
      <div className="dashboard-chart-header">
        <h2 className="card-header-title">Trend Mensile</h2>
        <div className="dashboard-chart-legend">
          <span className="dashboard-chart-legend-item">
            <span className="dashboard-chart-dot dashboard-chart-dot-income" /> Entrate
          </span>
          <span className="dashboard-chart-legend-item">
            <span className="dashboard-chart-dot dashboard-chart-dot-expense" /> Uscite
          </span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={formattedTrend} barCategoryGap="30%" barGap={4}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 12, fill: '#94a3b8' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `€${v}`}
            width={60}
          />
          <Tooltip content={CustomBarTooltip} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
          <Bar dataKey="income" name="Entrate" fill="#10B981" radius={[4, 4, 0, 0]} />
          <Bar dataKey="expense" name="Uscite" fill="#EF4444" radius={[4, 4, 0, 0]} opacity={0.8} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
