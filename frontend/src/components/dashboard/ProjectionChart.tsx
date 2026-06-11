import { useMemo } from 'react';
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ReferenceDot, ResponsiveContainer,
} from 'recharts';
import type { ProjectionPoint } from '../../types';
import { useFormatCurrency } from '../../hooks/useFormatCurrency';
import { useTheme } from '../../contexts/ThemeContext';

// Grafico dell'andamento del saldo nel look della landing (FragChart):
//   • tratto pieno  = storia recente reale (serie "actual")
//   • tratto tratteggiato = proiezione futura (serie "projected")
//   • dot "oggi" alla giunzione + dot a fine orizzonte
// Riusato sia dalla card Dashboard (compact) sia dalla pagina /projection.

const TEAL = '#0d9488';

interface ProjectionChartProps {
  points: ProjectionPoint[];
  height?: number;
  compact?: boolean;
}

interface ChartDatum {
  date: string;
  actual: number | null;
  projected: number | null;
}

const shortDate = (iso: string) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });

function ProjectionTooltip({ active, payload, formatCurrency }: any) {
  if (!active || !payload?.length) return null;
  const datum = payload[0].payload as ChartDatum;
  const value = datum.actual ?? datum.projected ?? 0;
  const isProjected = datum.actual == null;
  return (
    <div className="card card-md dashboard-tooltip">
      <p className="dashboard-tooltip-label">{shortDate(datum.date)}</p>
      <p className="dashboard-tooltip-amount">{formatCurrency(value)}</p>
      <p className="projection-chart-tip-tag">{isProjected ? 'Proiezione' : 'Saldo reale'}</p>
    </div>
  );
}

export default function ProjectionChart({ points, height = 220, compact = false }: ProjectionChartProps) {
  const { formatCurrency } = useFormatCurrency();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const gridColor = isDark ? '#44403c' : '#f1f5f9';
  const axisColor = isDark ? '#78716c' : '#a8a29e';

  const { data, anchor, last } = useMemo(() => {
    // Indice del primo punto proiettato = giunzione "oggi".
    const firstProjIdx = points.findIndex((p) => p.projected);
    const anchorIdx = firstProjIdx === -1 ? points.length - 1 : firstProjIdx;

    const chart: ChartDatum[] = points.map((p, i) => {
      // L'anchor appartiene a entrambe le serie così le due linee si connettono.
      const isAnchor = i === anchorIdx;
      return {
        date: p.date,
        actual: !p.projected || isAnchor ? p.balance : null,
        projected: p.projected ? p.balance : null,
      };
    });

    const anchorPt = points[anchorIdx];
    const lastPt = points[points.length - 1];
    return {
      data: chart,
      anchor: anchorPt ? { date: anchorPt.date, balance: anchorPt.balance } : null,
      last: lastPt ? { date: lastPt.date, balance: lastPt.balance } : null,
    };
  }, [points]);

  if (!points.length) return null;

  return (
    <div className="projection-chart" style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 12, right: 12, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="projection-area-fade" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={TEAL} stopOpacity={0.16} />
              <stop offset="1" stopColor={TEAL} stopOpacity={0} />
            </linearGradient>
          </defs>

          {!compact && (
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
          )}

          <XAxis
            dataKey="date"
            hide={compact}
            tickFormatter={shortDate}
            tick={{ fontSize: 11, fill: axisColor }}
            tickLine={false}
            axisLine={{ stroke: gridColor }}
            minTickGap={28}
          />
          <YAxis
            hide={compact}
            tick={{ fontSize: 11, fill: axisColor }}
            tickLine={false}
            axisLine={false}
            width={56}
            tickFormatter={(v) => formatCurrency(Number(v))}
          />

          <Tooltip content={<ProjectionTooltip formatCurrency={formatCurrency} />} />

          {anchor && (
            <ReferenceLine x={anchor.date} stroke={axisColor} strokeDasharray="3 4" strokeWidth={1} />
          )}

          <Area
            type="monotone"
            dataKey="actual"
            stroke={TEAL}
            strokeWidth={2.4}
            fill="url(#projection-area-fade)"
            dot={false}
            activeDot={{ r: 4, fill: TEAL }}
            connectNulls={false}
            isAnimationActive={!compact}
          />
          <Line
            type="monotone"
            dataKey="projected"
            stroke={TEAL}
            strokeWidth={2.2}
            strokeDasharray="2 6"
            dot={false}
            activeDot={{ r: 4, fill: TEAL }}
            connectNulls={false}
            isAnimationActive={!compact}
          />

          {anchor && (
            <ReferenceDot x={anchor.date} y={anchor.balance} r={4} fill={isDark ? '#292524' : '#ffffff'} stroke={TEAL} strokeWidth={2.4} />
          )}
          {last && (
            <ReferenceDot x={last.date} y={last.balance} r={5.5} fill={TEAL} stroke="none" />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
