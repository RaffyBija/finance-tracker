import { useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import type { NetWorthByAccountSeries } from '../../types';
import { useFormatCurrency } from '../../hooks/useFormatCurrency';
import { useTheme } from '../../contexts/ThemeContext';
import { formatMonthShort, formatMonth } from '../../utils/date';

// Andamento del patrimonio scomposto per conto: area impilata, un livello per
// conto BANK. La somma per mese coincide con la serie aggregata (NetWorthChart).

const FALLBACK = '#0d9488';
const isValidColor = (c?: string | null) => !!c && /^#[0-9A-Fa-f]{3,6}$/.test(c);

interface Props {
  data: NetWorthByAccountSeries;
  height?: number;
}

function StackTooltip({ active, payload, label, formatCurrency }: any) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((s: number, p: any) => s + Number(p.value), 0);
  return (
    <div className="card card-md dashboard-tooltip">
      <p className="dashboard-tooltip-label">{formatMonth(label + '-01')}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color }} className="dashboard-tooltip-value">
          {p.name}: {formatCurrency(Number(p.value))}
        </p>
      ))}
      <p className="dashboard-tooltip-amount">{formatCurrency(total)}</p>
    </div>
  );
}

export default function NetWorthByAccountChart({ data, height = 300 }: Props) {
  const { formatCurrency, formatCurrencyAxis } = useFormatCurrency();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const gridColor = isDark ? '#44403c' : '#f1f5f9';
  const axisColor = isDark ? '#78716c' : '#a8a29e';

  // Pivot: una riga per mese con una chiave per conto (accId → saldo).
  const rows = useMemo(() => {
    return data.months.map((month, i) => {
      const row: Record<string, number | string> = { month };
      for (const acc of data.accounts) row[acc.id] = acc.points[i]?.netWorth ?? 0;
      return row;
    });
  }, [data]);

  if (!data.accounts.length) return null;

  return (
    <div className="networth-chart" style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={rows} margin={{ top: 12, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
          <XAxis
            dataKey="month"
            tickFormatter={(m) => formatMonthShort(m + '-01')}
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
            tickFormatter={(v) => formatCurrencyAxis(Number(v))}
          />
          <Tooltip content={<StackTooltip formatCurrency={formatCurrency} />} />
          {data.accounts.map((acc) => {
            const color = isValidColor(acc.color) ? acc.color! : FALLBACK;
            return (
              <Area
                key={acc.id}
                type="monotone"
                dataKey={acc.id}
                name={acc.name}
                stackId="networth"
                stroke={color}
                strokeWidth={1.5}
                fill={color}
                fillOpacity={0.18}
                dot={false}
                activeDot={{ r: 3, fill: color }}
              />
            );
          })}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
