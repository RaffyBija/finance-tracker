import { useMemo, useState, memo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns';
import { useCategoryStats } from '../../../hooks/useDashboard';
import { formatMonth } from '../../../utils/date';
import { useFormatCurrency } from '../../../hooks/useFormatCurrency';
import { SkeletonPieChart } from '../../shared/Skeleton';

const FALLBACK_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#EC4899', '#14B8A6', '#F97316', '#84CC16', '#06B6D4',
  '#6366F1', '#D97706', '#BE185D', '#059669', '#DC2626',
  '#7C3AED', '#0284C7', '#CA8A04', '#16A34A', '#DB2777',
];

const isValidColor = (color?: string) =>
  !!color && color !== '#gray' && /^#[0-9A-Fa-f]{3,6}$/.test(color);

const getCategoryColor = (entry: { categoryColor?: string }, index: number) =>
  isValidColor(entry.categoryColor) ? entry.categoryColor! : FALLBACK_COLORS[index % FALLBACK_COLORS.length];

const CustomPieTooltip = memo(({ active, payload }: any) => {
  const { formatCurrency } = useFormatCurrency();
  if (!active || !payload?.length) return null;
  return (
    <div className="card card-md dashboard-tooltip">
      <p className="dashboard-tooltip-label">{payload[0].name}</p>
      <p className="dashboard-tooltip-amount">{formatCurrency(Number(payload[0].value))}</p>
    </div>
  );
});

const CustomPieLegend = memo(({ data }: { data: any[] }) => {
  const { formatCurrency } = useFormatCurrency();
  return (
    <div className="dashboard-legend">
      {data.slice(0, 8).map((entry, i) => (
        <div key={entry.categoryName} className="dashboard-legend-item">
          <span
            className="dashboard-legend-dot"
            style={{ width: 10, height: 10, background: getCategoryColor(entry, i) }}
          />
          <span className="dashboard-legend-name">{entry.categoryName}</span>
          <span className="dashboard-legend-value">{formatCurrency(Number(entry.total))}</span>
        </div>
      ))}
    </div>
  );
});

// Widget "Spese per categoria" — autonomo: possiede il proprio selettore mese
// (il mese tocca solo questo widget analitico, non l'Hero).
export default function CategoryPieWidget() {
  const [month, setMonth] = useState(new Date());

  const range = useMemo(() => ({
    startDate: format(startOfMonth(month), 'yyyy-MM-dd'),
    endDate: format(endOfMonth(month), 'yyyy-MM-dd'),
  }), [month]);

  const isCurrentMonth = useMemo(() => {
    const now = new Date();
    return month.getMonth() === now.getMonth() && month.getFullYear() === now.getFullYear();
  }, [month]);

  const { data: categoryStats = [], isLoading } = useCategoryStats(range);
  const expenseCategoryStats = useMemo(
    () => categoryStats.filter((s) => s.type === 'EXPENSE'),
    [categoryStats]
  );

  if (isLoading) return <SkeletonPieChart />;

  return (
    <div className="card">
      <div className="widget-head">
        <h3 className="widget-title">Spese per categoria</h3>
        <div className="widget-period">
          <button
            type="button"
            className="widget-period-btn"
            onClick={() => setMonth((d) => subMonths(d, 1))}
            aria-label="Mese precedente"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="widget-period-pill">{formatMonth(month)}</span>
          <button
            type="button"
            className="widget-period-btn"
            onClick={() => setMonth((d) => addMonths(d, 1))}
            disabled={isCurrentMonth}
            aria-label="Mese successivo"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {expenseCategoryStats.length === 0 ? (
        <div className="dashboard-chart-empty">Nessuna spesa registrata questo mese</div>
      ) : (
        <div className="dashboard-pie-body">
          <ResponsiveContainer width="55%" height="100%">
            <PieChart>
              <Pie
                data={expenseCategoryStats}
                cx="50%"
                cy="50%"
                innerRadius={65}
                outerRadius={100}
                dataKey="total"
                nameKey="categoryName"
                paddingAngle={2}
              >
                {expenseCategoryStats.map((entry, index) => (
                  <Cell key={`cell-${entry.categoryName}`} fill={getCategoryColor(entry, index)} />
                ))}
              </Pie>
              <Tooltip content={CustomPieTooltip} />
            </PieChart>
          </ResponsiveContainer>
          <div className="dashboard-pie-legend-wrap">
            <CustomPieLegend data={expenseCategoryStats} />
          </div>
        </div>
      )}
    </div>
  );
}
