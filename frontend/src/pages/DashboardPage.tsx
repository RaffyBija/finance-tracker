// frontend/src/pages/DashboardPage.tsx

import { useState, useMemo } from 'react';
import {
  useSummary,
  useCategoryStats,
  useMonthlyTrend,
  useRecentTransactions,
} from '../hooks/useDashboard';
import { TrendingUp, TrendingDown, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns';
import { it } from 'date-fns/locale';
import ProjectedDetailCard from '../components/dashboard/ProjectedDetailCard';
import {
  SkeletonChart,
  SkeletonPieChart,
  SkeletonList,
} from '../components/shared/Skeleton';

// ── Costanti colori ───────────────────────────────────────────────────────────

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

// ── Tooltip personalizzati ────────────────────────────────────────────────────

const CustomBarTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="card card-md text-sm shadow-lg">
      <p className="font-semibold text-neutral-700 mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }} className="font-medium">
          {p.name}: €{Number(p.value).toFixed(2)}
        </p>
      ))}
    </div>
  );
};

const CustomPieTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="card card-md text-sm shadow-lg">
      <p className="font-semibold text-neutral-700">{payload[0].name}</p>
      <p className="text-danger-600 font-medium">€{Number(payload[0].value).toFixed(2)}</p>
    </div>
  );
};

const CustomPieLegend = ({ data }: { data: any[] }) => (
  <div className="flex flex-col gap-2 justify-center pl-2">
    {data.slice(0, 8).map((entry, i) => (
      <div key={entry.categoryName} className="flex items-center gap-2 text-xs">
        <span
          className="inline-block rounded-full flex-shrink-0"
          style={{ width: 10, height: 10, background: getCategoryColor(entry, i) }}
        />
        <span className="text-neutral-600 truncate max-w-[110px]">{entry.categoryName}</span>
        <span className="ml-auto font-semibold text-neutral-800">€{Number(entry.total).toFixed(0)}</span>
      </div>
    ))}
  </div>
);

// ── Componente principale ─────────────────────────────────────────────────────

export default function DashboardPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const monthRange = useMemo(() => ({
    startDate: format(startOfMonth(currentMonth), 'yyyy-MM-dd'),
    endDate: format(endOfMonth(currentMonth), 'yyyy-MM-dd'),
  }), [currentMonth]);

  const isCurrentMonth = useMemo(() => {
    const now = new Date();
    return (
      currentMonth.getMonth() === now.getMonth() &&
      currentMonth.getFullYear() === now.getFullYear()
    );
  }, [currentMonth]);

  // ── Query indipendenti — ognuna gestisce il proprio skeleton ──
  const { data: summary,           isLoading: summaryLoading }      = useSummary(monthRange);
  const { data: totalSummary,      isLoading: totalSummaryLoading }  = useSummary();
  const { data: categoryStats = [], isLoading: statsLoading }        = useCategoryStats(monthRange);
  const { data: monthlyTrend = [],  isLoading: trendLoading }        = useMonthlyTrend(6);
  const { data: recentTransactions = [], isLoading: recentLoading }  = useRecentTransactions(5);

  const expenseCategoryStats = useMemo(
    () => categoryStats.filter((s) => s.type === 'EXPENSE'),
    [categoryStats]
  );

  const formattedTrend = useMemo(() =>
    monthlyTrend.map((item) => ({
      ...item,
      month: format(new Date(item.month + '-01'), 'MMM', { locale: it }),
    })),
    [monthlyTrend]
  );

  const totalBalance = totalSummary?.balance ?? 0;
  const isPositive = totalBalance >= 0;

  return (
    <div className="container-custom">

      {/* ── Hero: Saldo Complessivo ── */}
      <div className="dashboard-hero mb-6">
        <div className="dashboard-hero-top">
          <div>
            <p className="dashboard-hero-label">Saldo Complessivo</p>
            {totalSummaryLoading ? (
              <div className="dashboard-hero-value-skeleton animate-pulse" />
            ) : (
              <p className={`dashboard-hero-value${!isPositive ? ' is-negative' : ''}`}>
                {isPositive ? '+' : '−'}€{Math.abs(totalBalance).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            )}
          </div>
          <div className="dashboard-hero-nav">
            <button onClick={() => setCurrentMonth((d) => subMonths(d, 1))} className="dashboard-nav-btn">
              <ChevronLeft size={15} />
            </button>
            <span className="dashboard-month-pill">
              {format(currentMonth, 'MMMM yyyy', { locale: it })}
            </span>
            <button onClick={() => setCurrentMonth((d) => addMonths(d, 1))} disabled={isCurrentMonth} className="dashboard-nav-btn">
              <ChevronRight size={15} />
            </button>
            {!isCurrentMonth && (
              <button onClick={() => setCurrentMonth(new Date())} className="dashboard-today-btn">
                Oggi
              </button>
            )}
          </div>
        </div>

        <div key={format(currentMonth, 'yyyy-MM')} className="dashboard-hero-stats dashboard-stats-reveal">
          {summaryLoading ? (
            [0, 1, 2, 3].map((i) => (
              <div key={i} className="dashboard-hero-stat animate-pulse">
                <div style={{ height: '0.625rem', width: '3rem', background: 'rgba(255,255,255,0.2)', borderRadius: '0.25rem', marginBottom: '0.375rem' }} />
                <div style={{ height: '1.125rem', width: '5rem', background: 'rgba(255,255,255,0.25)', borderRadius: '0.25rem' }} />
              </div>
            ))
          ) : (
            <>
              <div className="dashboard-hero-stat">
                <p className="dashboard-hero-stat-label">Entrate</p>
                <p className="dashboard-hero-stat-value dashboard-hero-stat-income">+€{summary?.income.toFixed(2)}</p>
              </div>
              <div className="dashboard-hero-stat">
                <p className="dashboard-hero-stat-label">Uscite</p>
                <p className="dashboard-hero-stat-value dashboard-hero-stat-expense">−€{summary?.expense.toFixed(2)}</p>
              </div>
              <div className="dashboard-hero-stat">
                <p className="dashboard-hero-stat-label">Netto del mese</p>
                <p className={`dashboard-hero-stat-value${summary && summary.balance >= 0 ? ' dashboard-hero-stat-income' : ' dashboard-hero-stat-expense'}`}>
                  {summary && summary.balance >= 0 ? '+' : '−'}€{Math.abs(summary?.balance ?? 0).toFixed(2)}
                </p>
              </div>
              <div className="dashboard-hero-stat">
                <p className="dashboard-hero-stat-label">Transazioni</p>
                <p className="dashboard-hero-stat-value">{summary?.transactionCount}</p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Proiezione — gestisce il proprio skeleton internamente ── */}
      <ProjectedDetailCard />

      {/* ── Grafici ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">

        {/* Trend mensile */}
        {trendLoading ? (
          <SkeletonChart />
        ) : (
          <div className="card card-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="card-header-title">Trend Mensile</h2>
              <div className="flex items-center gap-3 text-xs text-neutral-500">
                <span className="flex items-center gap-1">
                  <span className="inline-block w-3 h-3 rounded-sm bg-success-500" /> Entrate
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block w-3 h-3 rounded-sm bg-danger-400" /> Uscite
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
                <Tooltip content={<CustomBarTooltip />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
                <Bar dataKey="income" name="Entrate" fill="#10B981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expense" name="Uscite" fill="#EF4444" radius={[4, 4, 0, 0]} opacity={0.8} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Spese per categoria */}
        {statsLoading ? (
          <SkeletonPieChart />
        ) : (
          <div className="card card-lg">
            <h2 className="card-header-title mb-4">
              Spese per Categoria
              <span className="text-sm font-normal text-neutral-400 ml-2 capitalize">
                {format(currentMonth, 'MMMM', { locale: it })}
              </span>
            </h2>
            {expenseCategoryStats.length === 0 ? (
              <div className="flex items-center justify-center h-[280px] text-neutral-400 text-sm">
                Nessuna spesa registrata questo mese
              </div>
            ) : (
              <div className="flex items-center gap-4 h-[280px]">
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
                        <Cell
                          key={`cell-${entry.categoryName}`}
                          fill={getCategoryColor(entry, index)}
                        />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomPieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 overflow-hidden">
                  <CustomPieLegend data={expenseCategoryStats} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Transazioni recenti ── */}
      {recentLoading ? (
        <SkeletonList rows={5} />
      ) : (
        <div className="card mb-8">
          <div className="card-header">
            <h2 className="card-header-title">Transazioni Recenti</h2>
          </div>
          <div className="card-divided">
            {recentTransactions.length === 0 ? (
              <div className="p-8 text-center text-neutral-400 text-sm">
                Nessuna transazione recente
              </div>
            ) : (
              recentTransactions.map((transaction) => (
                <div key={transaction.id} className="transaction-card">
                  <div className="transaction-card-left min-w-0 flex-1">
                    <div className={
                      transaction.type === 'INCOME'
                        ? 'transaction-card-icon-income flex-shrink-0'
                        : 'transaction-card-icon-expense flex-shrink-0'
                    }>
                      {transaction.type === 'INCOME'
                        ? <TrendingUp className="icon-md text-success-600" />
                        : <TrendingDown className="icon-md text-danger-600" />
                      }
                    </div>
                    <div className="transaction-card-info min-w-0">
                      <p className="transaction-card-title truncate">
                        {transaction.description || 'Nessuna descrizione'}
                      </p>
                      <p className="transaction-card-subtitle truncate">
                        {transaction.category?.name || 'Senza categoria'} •{' '}
                        {format(new Date(transaction.date), 'dd MMM yyyy', { locale: it })}
                      </p>
                    </div>
                  </div>
                  <div className="transaction-card-right flex-shrink-0">
                    <span className={
                      transaction.type === 'INCOME'
                        ? 'transaction-card-amount-income'
                        : 'transaction-card-amount-expense'
                    }>
                      {transaction.type === 'INCOME' ? '+' : '-'}€{Number(transaction.amount).toFixed(2)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

    </div>
  );
}