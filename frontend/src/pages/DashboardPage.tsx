// frontend/src/pages/DashboardPage.tsx

import { useState, useMemo, memo } from 'react';
import {
  useSummary,
  useCategoryStats,
  useMonthlyTrend,
  useRecentTransactions,
} from '../hooks/useDashboard';
import { useAccounts } from '../hooks/useAccounts';
import { TrendingUp, TrendingDown, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns';
import { it } from 'date-fns/locale';
import ProjectedDetailCard from '../components/dashboard/ProjectedDetailCard';
import ForecastCard from '../components/dashboard/ForecastCard';
import SubscriptionCostCard from '../components/dashboard/SubscriptionCostCard';
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

const CustomBarTooltip = memo(({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="card card-md dashboard-tooltip">
      <p className="dashboard-tooltip-label">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }} className="dashboard-tooltip-value">
          {p.name}: €{Number(p.value).toFixed(2)}
        </p>
      ))}
    </div>
  );
});

const CustomPieTooltip = memo(({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="card card-md dashboard-tooltip">
      <p className="dashboard-tooltip-label">{payload[0].name}</p>
      <p className="dashboard-tooltip-amount">€{Number(payload[0].value).toFixed(2)}</p>
    </div>
  );
});

const CustomPieLegend = memo(({ data }: { data: any[] }) => (
  <div className="dashboard-legend">
    {data.slice(0, 8).map((entry, i) => (
      <div key={entry.categoryName} className="dashboard-legend-item">
        <span
          className="dashboard-legend-dot"
          style={{ width: 10, height: 10, background: getCategoryColor(entry, i) }}
        />
        <span className="dashboard-legend-name">{entry.categoryName}</span>
        <span className="dashboard-legend-value">€{Number(entry.total).toFixed(0)}</span>
      </div>
    ))}
  </div>
));

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
  const { data: accounts = [] }                                       = useAccounts();

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

  const liquidAccounts = accounts.filter((a) => a.type !== 'CREDIT_CARD');
  const multiAccount = liquidAccounts.length > 1;
  const netWorth = liquidAccounts.reduce((s, a) => s + a.balance, 0);

  const heroValue = liquidAccounts.length > 0 ? netWorth : (totalSummary?.balance ?? 0);
  const heroLoading = liquidAccounts.length > 0 ? false : totalSummaryLoading;
  const heroPositive = heroValue >= 0;

  const fmt = (n: number) =>
    Math.abs(n).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="container-custom">

      {/* ── Hero ── */}
      <div className="dashboard-hero mb-6" data-tour="dashboard-hero">
        <div className="dashboard-hero-top">
          <div>
            <p className="dashboard-hero-label">
              {multiAccount ? 'Patrimonio netto' : 'Saldo Complessivo'}
            </p>
            {heroLoading ? (
              <div className="dashboard-hero-value-skeleton animate-pulse" />
            ) : (
              <p className={`dashboard-hero-value${!heroPositive ? ' is-negative' : ''}`}>
                {heroPositive ? '+' : '−'}€{fmt(heroValue)}
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

        {/* Breakdown per conto (solo multi-account) */}
        {multiAccount && (
          <div className="dashboard-hero-accounts">
            {liquidAccounts.map((a) => (
              <div key={a.id} className="dashboard-hero-account-row">
                <span className="dashboard-hero-account-name">
                  <span
                    className="dashboard-hero-account-dot"
                    style={{ backgroundColor: a.color }}
                  />
                  {a.name}
                </span>
                <span className={`dashboard-hero-account-amount${a.balance < 0 ? ' is-negative' : ''}`}>
                  {a.balance >= 0 ? '+' : '−'}€{fmt(a.balance)}
                </span>
              </div>
            ))}
          </div>
        )}

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

      {/* ── Previsione fine mese + Abbonamenti ── */}
      <div className="dashboard-analytics-grid">
        <ForecastCard />
        <SubscriptionCostCard />
      </div>

      {/* ── Grafici ── */}
      <div className="dashboard-charts-grid">

        {/* Trend mensile */}
        {trendLoading ? (
          <SkeletonChart />
        ) : (
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
        )}

        {/* Spese per categoria */}
        {statsLoading ? (
          <SkeletonPieChart />
        ) : (
          <div className="card card-lg">
            <h2 className="card-header-title mb-4">
              Spese per Categoria
              <span className="dashboard-pie-month">
                {format(currentMonth, 'MMMM', { locale: it })}
              </span>
            </h2>
            {expenseCategoryStats.length === 0 ? (
              <div className="dashboard-chart-empty">
                Nessuna spesa registrata questo mese
              </div>
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
                        <Cell
                          key={`cell-${entry.categoryName}`}
                          fill={getCategoryColor(entry, index)}
                        />
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
              <div className="dashboard-empty-state">
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