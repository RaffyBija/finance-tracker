import { useMemo } from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { SpendingAnalysis } from '../../types';
import { useFormatCurrency } from '../../hooks/useFormatCurrency';
import { KINDS, comparePeriod, periodOutlook, periodTotals } from './model';
import { useChartTheme, spendTone, periodAxisLabel, periodLabel, pct } from './ui';
import { signOf } from '../patrimonio/tone';

// Scheda "Spese": quanto ho speso nel periodo, rispetto al solito, di che natura
// (fisse / programmate / variabili), quanto ho risparmiato e, per il periodo in
// corso, dove arriverò a fine periodo. Sotto, il confronto tra tutti i periodi.

interface Props {
  data: SpendingAnalysis;
  selected: number;
  onSelect: (index: number) => void;
}

function PeriodTooltip({ active, payload, formatCurrency }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="card card-md dashboard-tooltip">
      <p className="dashboard-tooltip-label">{d.label}</p>
      {KINDS.map((k) => (
        <p key={k.id} className="dashboard-tooltip-value">{k.label}: {formatCurrency(d[k.id])}</p>
      ))}
      <p className="dashboard-tooltip-value analysis-tooltip-strong">Totale: {formatCurrency(d.total)}</p>
      <p className="dashboard-tooltip-value">Entrate: {formatCurrency(d.income)}</p>
    </div>
  );
}

export default function SpendingOverview({ data, selected, onSelect }: Props) {
  const { formatCurrency, formatCurrencyAxis } = useFormatCurrency();
  const theme = useChartTheme();

  const totals = useMemo(() => periodTotals(data), [data]);
  const cmp = useMemo(() => comparePeriod(data, selected), [data, selected]);
  const outlook = useMemo(() => periodOutlook(data, selected, cmp), [data, selected, cmp]);
  const t = totals[selected];
  const period = data.periods[selected];

  const delta = cmp.avgTotal === null ? null : cmp.total - cmp.avgTotal;
  const tone = spendTone(delta);
  const rateDelta = cmp.avgVariablePerDay === null ? null : cmp.variablePerDay - cmp.avgVariablePerDay;

  const chartData = data.periods.map((p, i) => ({
    label: periodLabel(p, data.mode),
    axis: periodAxisLabel(p, data.mode),
    ...totals[i],
    index: i,
  }));

  return (
    <div className="lens-stack">
      {/* ── Il numero del periodo ── */}
      <div className="card analysis-hero">
        <span className="analysis-hero-label">{period.isCurrent ? 'Speso finora' : 'Speso nel periodo'}</span>
        <span className="analysis-hero-value">{formatCurrency(t.total)}</span>
        {delta !== null ? (
          <span className={`analysis-hero-delta is-${tone}`}>
            {tone === 'negative' ? <TrendingUp size={15} /> : tone === 'positive' ? <TrendingDown size={15} /> : <Minus size={15} />}
            {signOf(delta)}{formatCurrency(Math.abs(delta))}
            {cmp.avgTotal ? ` (${signOf(delta)}${pct(Math.abs(delta) / cmp.avgTotal)})` : ''}
            <span className="analysis-hero-delta-note">
              {cmp.sameDate ? 'rispetto alla media alla stessa data' : 'rispetto alla media degli altri periodi'}
            </span>
          </span>
        ) : (
          <span className="analysis-hero-delta is-neutral">Nessun periodo chiuso con cui confrontare</span>
        )}

        {/* Composizione per natura */}
        {t.total > 0 && (
          <>
            <div className="analysis-composition" role="img" aria-label="Composizione della spesa per natura">
              {KINDS.map((k) => t[k.id] > 0 && (
                <span
                  key={k.id}
                  className="analysis-composition-segment"
                  style={{ flexGrow: t[k.id], backgroundColor: theme.kind[k.id] }}
                />
              ))}
            </div>
            <ul className="analysis-kind-legend">
              {KINDS.map((k) => (
                <li key={k.id} className="analysis-kind-item" title={k.hint}>
                  <span className="analysis-kind-dot" style={{ backgroundColor: theme.kind[k.id] }} />
                  <span className="analysis-kind-name">{k.label}</span>
                  <span className="analysis-kind-value">{formatCurrency(t[k.id])}</span>
                  <span className="analysis-kind-share">{t.total > 0 ? pct(t[k.id] / t.total) : '0%'}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {/* ── Indicatori ── */}
      <div className="patrimonio-stats">
        <div className="patrimonio-stat">
          <span className="patrimonio-stat-label">Variabili al giorno</span>
          <span className="patrimonio-stat-value">{formatCurrency(cmp.variablePerDay)}</span>
          <span className={`patrimonio-stat-meta${rateDelta !== null && Math.abs(rateDelta) >= 0.5 ? ` is-${spendTone(rateDelta)}` : ''}`}>
            {cmp.avgVariablePerDay !== null ? `media ${formatCurrency(cmp.avgVariablePerDay)} al giorno` : 'nessuna media disponibile'}
          </span>
        </div>
        <div className="patrimonio-stat">
          <span className="patrimonio-stat-label">Entrate</span>
          <span className="patrimonio-stat-value">{formatCurrency(t.income)}</span>
          <span className="patrimonio-stat-meta">{period.isCurrent ? 'finora nel periodo' : 'nel periodo'}</span>
        </div>
        <div className="patrimonio-stat">
          <span className="patrimonio-stat-label">Risparmiato</span>
          <span className={`patrimonio-stat-value is-${t.saved > 0 ? 'positive' : t.saved < 0 ? 'negative' : 'neutral'}`}>
            {signOf(t.saved)}{formatCurrency(Math.abs(t.saved))}
          </span>
          <span className="patrimonio-stat-meta">
            {t.savingsRate !== null
              ? `${pct(t.savingsRate)} delle entrate${period.isCurrent ? ' finora' : ''}`
              : 'nessuna entrata nel periodo'}
          </span>
        </div>
        {outlook !== null && (
          <div className="patrimonio-stat">
            <span className="patrimonio-stat-label">Stima a fine periodo</span>
            <span className="patrimonio-stat-value">{formatCurrency(outlook)}</span>
            <span className="patrimonio-stat-meta">
              {data.knownRemaining > 0
                ? `con ${formatCurrency(data.knownRemaining)} di impegni ancora attesi`
                : 'al ritmo medio dei periodi chiusi'}
            </span>
          </div>
        )}
      </div>

      {/* ── Confronto tra periodi ── */}
      <div className="card">
        <div className="widget-head widget-head--wrap">
          <h3 className="widget-title">Spese per periodo</h3>
          <ul className="analysis-chart-legend">
            {KINDS.map((k) => (
              <li key={k.id}><span className="analysis-kind-dot" style={{ backgroundColor: theme.kind[k.id] }} />{k.label}</li>
            ))}
            <li><span className="analysis-legend-line" style={{ backgroundColor: theme.income }} />Entrate</li>
          </ul>
        </div>
        <div className="analysis-chart">
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart
              data={chartData}
              margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
              barCategoryGap="28%"
              onClick={(e: any) => {
                const i = e?.activePayload?.[0]?.payload?.index;
                if (typeof i === 'number') onSelect(i);
              }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} vertical={false} />
              <XAxis dataKey="axis" tick={{ fontSize: 11, fill: theme.axis }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fontSize: 11, fill: theme.axis }}
                axisLine={false}
                tickLine={false}
                width={56}
                tickFormatter={(v) => formatCurrencyAxis(Number(v))}
              />
              <Tooltip content={<PeriodTooltip formatCurrency={formatCurrency} />} cursor={{ fill: theme.isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' }} />
              {KINDS.map((k, ki) => (
                <Bar
                  key={k.id}
                  dataKey={k.id}
                  stackId="spend"
                  fill={theme.kind[k.id]}
                  stroke={theme.surface}
                  strokeWidth={2}
                  radius={ki === KINDS.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                  isAnimationActive={false}
                >
                  {chartData.map((d) => (
                    <Cell key={d.index} fillOpacity={d.index === selected ? 1 : 0.45} cursor="pointer" />
                  ))}
                </Bar>
              ))}
              <Line
                type="monotone"
                dataKey="income"
                stroke={theme.income}
                strokeWidth={2}
                dot={{ r: 3, fill: theme.income, strokeWidth: 0 }}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <p className="analysis-chart-note">
          Tocca una colonna per analizzarne il periodo. Le spese su carta contano alla data dell'acquisto; trasferimenti e addebiti carta sono esclusi.
        </p>
      </div>
    </div>
  );
}
