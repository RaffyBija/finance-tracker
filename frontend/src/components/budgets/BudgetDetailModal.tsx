import {
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer,
} from 'recharts';
import { Pencil, Trash2 } from 'lucide-react';
import BaseModal from '../layout/ModalBase';
import type { Budget } from '../../types';
import { useBudgetHistory } from '../../hooks/useBudgets';
import { useFormatCurrency } from '../../hooks/useFormatCurrency';
import { useTheme } from '../../contexts/ThemeContext';
import { SkeletonChart } from '../shared/Skeleton';

interface BudgetDetailModalProps {
  isOpen: boolean;
  budget: Budget | null;
  onClose: () => void;
  onEdit: (budget: Budget) => void;
  onDelete: (id: string) => void;
}

const COLOR_TARGET = '#0d9488'; // teal: l'unico accento, marca la soglia-budget

// Colore della barra per stato di aderenza, COERENTE con la progress bar della
// card (verde entro, ambra vicino al limite, rosso sforato). Il colore qui è un
// fatto finanziario, non decorazione.
function barFill(percentage: number, isDark: boolean): string {
  if (percentage >= 100) return isDark ? '#f87171' : '#ef4444'; // danger
  if (percentage >= 80) return isDark ? '#fbbf24' : '#f59e0b'; // warning
  return isDark ? '#34d399' : '#10b981'; // success
}

function HistoryTooltip({ active, payload, formatCurrency, baseAmount, showRollover }: any) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  const carry = row.budgeted - baseAmount;
  return (
    <div className="card card-md dashboard-tooltip">
      <p className="dashboard-tooltip-label">{row.label}</p>
      <p className="dashboard-tooltip-value">Speso: {formatCurrency(row.spent)}</p>
      <p className="dashboard-tooltip-value">Budget: {formatCurrency(row.budgeted)}</p>
      {showRollover && Math.abs(carry) >= 0.005 && (
        <p className="dashboard-tooltip-value">
          Riporto: {carry >= 0 ? '+' : '−'}
          {formatCurrency(Math.abs(carry))}
        </p>
      )}
      <p className="dashboard-tooltip-amount">
        {row.exceeded
          ? `Sforato di ${formatCurrency(row.spent - row.budgeted)}`
          : `Rimasto ${formatCurrency(row.budgeted - row.spent)}`}
      </p>
    </div>
  );
}

export default function BudgetDetailModal({
  isOpen,
  budget,
  onClose,
  onEdit,
  onDelete,
}: BudgetDetailModalProps) {
  const { data, isLoading } = useBudgetHistory(isOpen && budget ? budget.id : null, 6);
  const { formatCurrency, formatCurrencyAxis } = useFormatCurrency();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const gridColor = isDark ? '#44403c' : '#e7e5e4';
  const axisColor = isDark ? '#78716c' : '#a8a29e';

  if (!isOpen || !budget) return null;

  const stats = data?.stats;
  const history = data?.history ?? [];
  const hasTrend = history.length >= 2;
  // Il dominio Y include sempre la soglia-budget, così la linea-target teal
  // resta visibile anche quando la spesa è sotto il budget.
  const yMax = Math.max(
    Number(budget.amount),
    ...history.map((h) => h.budgeted),
    ...history.map((h) => h.spent),
  );

  return (
    <BaseModal isOpen={isOpen} title={budget.name} onClose={onClose}>
      <div className="budget-detail">
        <p className="budget-detail-sub">
          {budget.category?.name || 'Tutte le categorie'} · {budget.periodLabel}
        </p>

        {isLoading ? (
          <SkeletonChart />
        ) : !hasTrend ? (
          <div className="dashboard-chart-empty">
            Servono almeno due periodi per mostrare un andamento. Torna qui il
            prossimo periodo per confrontare budget e spesa reale.
          </div>
        ) : (
          <>
            <div className="widget-head">
              <h3 className="widget-title">Budget vs reale</h3>
              <span className="widget-subtitle">Ultimi {history.length} periodi</span>
            </div>

            <div className="budget-detail-chart">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={history} barCategoryGap="28%" margin={{ top: 8, right: 48, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: axisColor }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0, Math.ceil(yMax / 50) * 50]}
                    tick={{ fontSize: 11, fill: axisColor }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => formatCurrencyAxis(Number(v))}
                    width={56}
                  />
                  <Tooltip
                    content={
                      <HistoryTooltip
                        formatCurrency={formatCurrency}
                        baseAmount={Number(budget.amount)}
                        showRollover={budget.rollover !== 'NONE'}
                      />
                    }
                    cursor={{ fill: 'rgba(0,0,0,0.03)' }}
                  />
                  <ReferenceLine
                    y={budget.amount}
                    stroke={COLOR_TARGET}
                    strokeDasharray="5 4"
                    strokeWidth={1.5}
                    label={{
                      // Con rollover la soglia varia per periodo (barre colorate
                      // sull'effettivo): questa linea è solo l'importo BASE, non il
                      // target del periodo. La rinominiamo per non contraddire le barre.
                      value: budget.rollover === 'NONE' ? 'Budget' : 'Base',
                      position: 'right',
                      fill: COLOR_TARGET,
                      fontSize: 11,
                    }}
                  />
                  <Bar dataKey="spent" radius={[4, 4, 0, 0]} maxBarSize={48}>
                    {history.map((h) => (
                      <Cell key={h.periodStart} fill={barFill(h.percentage, isDark)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        )}

        {stats && stats.totalPeriods > 0 && (
          <div className="patrimonio-stats budget-detail-stats">
            <div className="patrimonio-stat">
              <span className="patrimonio-stat-label">Media spesa</span>
              <span className="patrimonio-stat-value">{formatCurrency(stats.avgSpent)}</span>
            </div>
            <div className="patrimonio-stat">
              <span className="patrimonio-stat-label">Aderenza</span>
              <span
                className={`patrimonio-stat-value ${
                  stats.adherenceRate >= 80
                    ? 'is-positive'
                    : stats.adherenceRate >= 50
                    ? 'is-neutral'
                    : 'is-negative'
                }`}
              >
                {stats.adherenceRate.toFixed(0)}%
              </span>
            </div>
            <div className="patrimonio-stat">
              <span className="patrimonio-stat-label">Sforamenti</span>
              <span className="patrimonio-stat-value">
                {stats.exceededCount} su {stats.totalPeriods}
              </span>
            </div>
            {stats.worstPeriod && (
              <div className="patrimonio-stat">
                <span className="patrimonio-stat-label">Periodo peggiore</span>
                <span className="patrimonio-stat-value patrimonio-stat-value--sm">
                  {stats.worstPeriod.label}
                </span>
                <span className="patrimonio-stat-meta">
                  {formatCurrency(stats.worstPeriod.spent)}
                </span>
              </div>
            )}
          </div>
        )}

        <div className="form-actions">
          <button
            type="button"
            className="btn btn-ghost btn-md"
            onClick={() => onDelete(budget.id)}
          >
            <Trash2 className="icon-sm" /> Elimina
          </button>
          <button
            type="button"
            className="btn btn-primary btn-md"
            onClick={() => onEdit(budget)}
          >
            <Pencil className="icon-sm" /> Modifica
          </button>
        </div>
      </div>
    </BaseModal>
  );
}
