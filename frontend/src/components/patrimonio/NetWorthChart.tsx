import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceDot, ResponsiveContainer,
} from 'recharts';
import type { NetWorthPoint } from '../../types';
import { useFormatCurrency } from '../../hooks/useFormatCurrency';
import { useTheme } from '../../contexts/ThemeContext';
import { formatMonthShort, formatMonth } from '../../utils/date';

// Andamento storico del patrimonio netto — stessa estetica teal di ProjectionChart
// (area con gradiente), ma guarda all'indietro: tutto "reale", granularità mensile.

const TEAL = '#0d9488';

interface NetWorthChartProps {
  points: NetWorthPoint[];
  height?: number;
}

const axisLabel = (month: string) => formatMonthShort(month + '-01');

function NetWorthTooltip({ active, payload, formatCurrency }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload as NetWorthPoint;
  return (
    <div className="card card-md dashboard-tooltip">
      <p className="dashboard-tooltip-label">{formatMonth(p.month + '-01')}</p>
      <p className="dashboard-tooltip-amount">{formatCurrency(p.netWorth)}</p>
    </div>
  );
}

export default function NetWorthChart({ points, height = 300 }: NetWorthChartProps) {
  const { formatCurrency } = useFormatCurrency();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const gridColor = isDark ? '#44403c' : '#f1f5f9';
  const axisColor = isDark ? '#78716c' : '#a8a29e';

  if (!points.length) return null;
  const last = points[points.length - 1];

  return (
    <div className="networth-chart" style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 12, right: 12, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="networth-area-fade" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={TEAL} stopOpacity={0.16} />
              <stop offset="1" stopColor={TEAL} stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
          <XAxis
            dataKey="month"
            tickFormatter={axisLabel}
            tick={{ fontSize: 11, fill: axisColor }}
            tickLine={false}
            axisLine={{ stroke: gridColor }}
            minTickGap={20}
          />
          <YAxis
            tick={{ fontSize: 11, fill: axisColor }}
            tickLine={false}
            axisLine={false}
            width={56}
            tickFormatter={(v) => formatCurrency(Number(v))}
          />
          <Tooltip content={<NetWorthTooltip formatCurrency={formatCurrency} />} />

          <Area
            type="monotone"
            dataKey="netWorth"
            stroke={TEAL}
            strokeWidth={2.4}
            fill="url(#networth-area-fade)"
            dot={false}
            activeDot={{ r: 4, fill: TEAL }}
          />
          <ReferenceDot x={last.month} y={last.netWorth} r={5.5} fill={TEAL} stroke="none" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
