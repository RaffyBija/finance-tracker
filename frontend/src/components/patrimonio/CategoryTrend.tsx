import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { useCategoryTrend } from '../../hooks/useDashboard';
import { useFormatCurrency } from '../../hooks/useFormatCurrency';
import { useTheme } from '../../contexts/ThemeContext';
import { formatMonthShort, formatMonth } from '../../utils/date';
import { SkeletonChart } from '../shared/Skeleton';

// Trend di spesa per categoria nel tempo: barre impilate (un segmento per
// categoria, top N + "Altre"). Mostra come si spostano le abitudini di spesa.

const FALLBACK = '#a8a29e';
const isValidColor = (c?: string | null) => !!c && /^#[0-9A-Fa-f]{3,6}$/.test(c);

interface CategoryTrendProps {
  months: number;
}

function TrendTooltip({ active, payload, label, formatCurrency }: any) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((s: number, p: any) => s + Number(p.value), 0);
  const shown = payload.filter((p: any) => Number(p.value) > 0);
  return (
    <div className="card card-md dashboard-tooltip">
      <p className="dashboard-tooltip-label">{formatMonth(label + '-01')}</p>
      {shown.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color }} className="dashboard-tooltip-value">
          {p.name}: {formatCurrency(Number(p.value))}
        </p>
      ))}
      <p className="dashboard-tooltip-amount">{formatCurrency(total)}</p>
    </div>
  );
}

export default function CategoryTrend({ months }: CategoryTrendProps) {
  const { data, isLoading } = useCategoryTrend(months);
  const { formatCurrency, formatCurrencyAxis } = useFormatCurrency();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const gridColor = isDark ? '#44403c' : '#e7e5e4';
  const axisColor = isDark ? '#78716c' : '#a8a29e';

  const rows = useMemo(() => {
    if (!data) return [];
    return data.months.map((month, i) => {
      const row: Record<string, number | string> = { month };
      for (const c of data.categories) row[c.id] = c.totals[i] ?? 0;
      return row;
    });
  }, [data]);

  if (isLoading) return <SkeletonChart />;

  const hasData = !!data && data.categories.length > 0;

  return (
    <div className="card">
      <div className="widget-head">
        <h3 className="widget-title">Spese per categoria nel tempo</h3>
        <span className="widget-subtitle">Ultimi {months} mesi</span>
      </div>

      {!hasData ? (
        <div className="dashboard-chart-empty">Nessuna spesa nel periodo</div>
      ) : (
        <>
          <div className="category-trend-chart">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={rows} barCategoryGap="28%" margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                <XAxis
                  dataKey="month"
                  tickFormatter={(m) => formatMonthShort(m + '-01')}
                  tick={{ fontSize: 12, fill: axisColor }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: axisColor }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => formatCurrencyAxis(Number(v))}
                  width={56}
                />
                <Tooltip content={<TrendTooltip formatCurrency={formatCurrency} />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
                {data!.categories.map((c, i) => (
                  <Bar
                    key={c.id}
                    dataKey={c.id}
                    name={c.name}
                    stackId="spese"
                    fill={isValidColor(c.color) ? c.color! : FALLBACK}
                    radius={i === data!.categories.length - 1 ? [4, 4, 0, 0] : undefined}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="category-trend-legend">
            {data!.categories.map((c) => (
              <span key={c.id} className="category-trend-legend-item">
                <span className="dashboard-legend-dot" style={{ background: isValidColor(c.color) ? c.color! : FALLBACK }} />
                {c.name}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
