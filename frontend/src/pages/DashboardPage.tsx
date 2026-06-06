// frontend/src/pages/DashboardPage.tsx

import { useState, useMemo, memo } from 'react';
import {
  useSummary,
  useCategoryStats,
  useMonthlyTrend,
  useRecentTransactions,
} from '../hooks/useDashboard';
import { useAccounts } from '../hooks/useAccounts';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns';
import { it } from 'date-fns/locale';
import BalanceOutlookCard from '../components/dashboard/BalanceOutlookCard';
import SubscriptionCostCard from '../components/dashboard/SubscriptionCostCard';
import TransactionRow from '../components/shared/TransactionRow';
import {
  SkeletonChart,
  SkeletonPieChart,
  SkeletonList,
} from '../components/shared/Skeleton';
import { useFormatCurrency } from '../hooks/useFormatCurrency';

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

// ── Componente principale ─────────────────────────────────────────────────────

export default function DashboardPage() {
  const { formatCurrency } = useFormatCurrency();
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
  const { data: accounts = [], isLoading: accountsLoading }           = useAccounts();

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

  // Finché i conti non sono caricati non sappiamo se mostrare netWorth (liquidità
  // BANK) o il saldo all-time: mostrare quest'ultimo a metà caricamento causa un
  // flicker (include le CC). Aspettiamo i conti prima di decidere.
  const hasAccounts = liquidAccounts.length > 0;
  const heroValue = hasAccounts ? netWorth : (totalSummary?.balance ?? 0);
  const heroLoading = accountsLoading || (!hasAccounts && totalSummaryLoading);
  const heroPositive = heroValue >= 0;


  return (
    <div className="container-custom">

      {/* ── Hero ── */}
      <div className="dashboard-hero mb-6" data-tour="dashboard-hero">
        <div className="dashboard-hero-top">
          <div>
            <p className="dashboard-hero-label">
              {multiAccount ? 'Liquidità totale' : 'Liquidità disponibile'}
            </p>
            {heroLoading ? (
              <div className="dashboard-hero-value-skeleton animate-pulse" />
            ) : (
              <p className={`dashboard-hero-value${!heroPositive ? ' is-negative' : ''}`}>
                {heroPositive ? '+' : '−'}{formatCurrency(Math.abs(heroValue))}
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
                  {a.balance >= 0 ? '+' : '−'}{formatCurrency(Math.abs(a.balance))}
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
                <p className="dashboard-hero-stat-value dashboard-hero-stat-income">+{formatCurrency(summary?.income ?? 0)}</p>
              </div>
              <div className="dashboard-hero-stat">
                <p className="dashboard-hero-stat-label">Uscite</p>
                <p className="dashboard-hero-stat-value dashboard-hero-stat-expense">−{formatCurrency(summary?.expense ?? 0)}</p>
              </div>
              <div className="dashboard-hero-stat">
                <p className="dashboard-hero-stat-label">Netto del mese</p>
                <p className={`dashboard-hero-stat-value${summary && summary.balance >= 0 ? ' dashboard-hero-stat-income' : ' dashboard-hero-stat-expense'}`}>
                  {summary && summary.balance >= 0 ? '+' : '−'}{formatCurrency(Math.abs(summary?.balance ?? 0))}
                </p>
              </div>
              <div className="dashboard-hero-stat">
                <p className="dashboard-hero-stat-label">Transazioni</p>
                <p className="dashboard-hero-stat-value">{summary?.transactionCount}</p>
              </div>
            </>
          )}
        </div>

        {!summaryLoading && (
          <p className="dashboard-hero-stats-caption">
            Movimenti del mese · tutti i conti (CC inclusa)
          </p>
        )}
      </div>

      {/* ── Andamento del saldo (impegni certi / stima realistica) ── */}
      <BalanceOutlookCard />

      {/* ── Spese ricorrenti ── */}
      <div className="dashboard-analytics-grid">
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
                <TransactionRow key={transaction.id} transaction={transaction} />
              ))
            )}
          </div>
        </div>
      )}

    </div>
  );
}