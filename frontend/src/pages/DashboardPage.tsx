import { useState, useMemo } from 'react';
import {
  useSummary,
  useCategoryStats,
  useMonthlyTrend,
  useRecentTransactions,
  useProjectedBalance,
  useProjectedBalanceByDate,
} from '../hooks/useDashboard';
import { TrendingUp, TrendingDown, Wallet, Activity, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns';
import { it } from 'date-fns/locale';
import ProjectedDetailCard from '../components/dashboard/ProjectedDetailCard.tsx';
import LoadingSpinner from '../components/shared/LoadingSpinner';

// ─── Colori palette ───────────────────────────────────────────────────────────
const CHART_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444',
  '#8B5CF6', '#EC4899', '#14B8A6', '#F97316',
];

// ─── Custom Tooltip per il BarChart ──────────────────────────────────────────
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

// ─── Custom Tooltip per il PieChart ──────────────────────────────────────────
const CustomPieTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="card card-md text-sm shadow-lg">
      <p className="font-semibold text-neutral-700">{payload[0].name}</p>
      <p className="text-danger-600 font-medium">€{Number(payload[0].value).toFixed(2)}</p>
    </div>
  );
};

// ─── Custom Legend per il PieChart ────────────────────────────────────────────
const CustomPieLegend = ({ data, colors }: { data: any[]; colors: string[] }) => (
  <div className="flex flex-col gap-2 justify-center pl-2">
    {data.slice(0, 6).map((entry, i) => (
      <div key={entry.categoryName} className="flex items-center gap-2 text-xs">
        <span
          className="inline-block rounded-full flex-shrink-0"
          style={{ width: 10, height: 10, background: entry.categoryColor || colors[i % colors.length] }}
        />
        <span className="text-neutral-600 truncate max-w-[110px]">{entry.categoryName}</span>
        <span className="ml-auto font-semibold text-neutral-800">€{Number(entry.total).toFixed(0)}</span>
      </div>
    ))}
  </div>
);

// ─── Componente principale ────────────────────────────────────────────────────
export default function DashboardPage() {
  // Navigazione mese
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const monthRange = useMemo(() => ({
    startDate: format(startOfMonth(currentMonth), 'yyyy-MM-dd'),
    endDate: format(endOfMonth(currentMonth), 'yyyy-MM-dd'),
  }), [currentMonth]);

  const isCurrentMonth = useMemo(() => {
    const now = new Date();
    return currentMonth.getMonth() === now.getMonth() && currentMonth.getFullYear() === now.getFullYear();
  }, [currentMonth]);

  // Proiezione
  const [projectionMonths, setProjectionMonths] = useState(1);
  const [projectionRange, setProjectionRange] = useState({ startDate: '', endDate: '' });

  // Query — summary e categoryStats filtrate per mese
  const { data: summary, isLoading: summaryLoading } = useSummary(monthRange);
  const { data: categoryStats = [], isLoading: statsLoading } = useCategoryStats(monthRange);
  const { data: monthlyTrend = [], isLoading: trendLoading } = useMonthlyTrend(6);
  const { data: recentTransactions = [], isLoading: recentLoading } = useRecentTransactions(5);

  const { data: projectedBalance, isLoading: projectedLoading } = useProjectedBalance(
    projectionMonths,
    projectionMonths > 0
  );
  const { data: projectedBalanceByDate, isLoading: projectedByDateLoading } = useProjectedBalanceByDate(
    projectionRange.startDate,
    projectionRange.endDate,
    projectionMonths === 0 && !!projectionRange.startDate && !!projectionRange.endDate
  );

  const isLoading =
    summaryLoading || statsLoading || trendLoading || recentLoading ||
    projectedLoading || projectedByDateLoading;

  const activeProjectedBalance = projectionMonths > 0 ? projectedBalance : projectedBalanceByDate;

  // Dati per il PieChart (solo EXPENSE)
  const expenseCategoryStats = useMemo(
    () => categoryStats.filter((s) => s.type === 'EXPENSE'),
    [categoryStats]
  );

  // Formatta i mesi nel trend (es. "2025-03" → "Mar")
  const formattedTrend = useMemo(() =>
    monthlyTrend.map((item) => ({
      ...item,
      month: format(new Date(item.month + '-01'), 'MMM', { locale: it }),
    })),
    [monthlyTrend]
  );

  if (isLoading) {
    return <LoadingSpinner message="Caricamento Dashboard ..." />;
  }

  return (
    <div className="container-custom">

      {/* ── Header con navigazione mese ──────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900">Dashboard</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Situazione finanziaria di{' '}
            <span className="font-semibold text-neutral-700">
              {format(currentMonth, 'MMMM yyyy', { locale: it })}
            </span>
          </p>
        </div>

        {/* Navigatore mese */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => setCurrentMonth((d) => subMonths(d, 1))}
            className="btn btn-ghost btn-sm"
            title="Mese precedente"
          >
            <ChevronLeft className="icon-sm" />
          </button>

          <span className="px-4 py-1.5 rounded-lg bg-neutral-100 text-sm font-semibold text-neutral-700 min-w-[130px] text-center capitalize">
            {format(currentMonth, 'MMMM yyyy', { locale: it })}
          </span>

          <button
            onClick={() => setCurrentMonth((d) => addMonths(d, 1))}
            disabled={isCurrentMonth}
            className="btn btn-ghost btn-sm disabled:opacity-40"
            title="Mese successivo"
          >
            <ChevronRight className="icon-sm" />
          </button>

          {!isCurrentMonth && (
            <button
              onClick={() => setCurrentMonth(new Date())}
              className="btn btn-outline-primary btn-sm"
            >
              Oggi
            </button>
          )}
        </div>
      </div>

      {/* ── Summary Cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="stat-card">
          <div className="flex-between">
            <div>
              <p className="stat-card-label">Entrate</p>
              <p className="stat-card-value text-success-600">
                €{summary?.income.toFixed(2)}
              </p>
            </div>
            <TrendingUp className="icon-2xl text-success-600" />
          </div>
        </div>

        <div className="stat-card">
          <div className="flex-between">
            <div>
              <p className="stat-card-label">Uscite</p>
              <p className="stat-card-value text-danger-600">
                €{summary?.expense.toFixed(2)}
              </p>
            </div>
            <TrendingDown className="icon-2xl text-danger-600" />
          </div>
        </div>

        <div className="stat-card">
          <div className="flex-between">
            <div>
              <p className="stat-card-label">Saldo del mese</p>
              <p className={`stat-card-value ${summary && summary.balance >= 0 ? 'text-primary-600' : 'text-danger-600'}`}>
                €{summary?.balance.toFixed(2)}
              </p>
            </div>
            <Wallet className="icon-2xl text-primary-600" />
          </div>
        </div>

        <div className="stat-card">
          <div className="flex-between">
            <div>
              <p className="stat-card-label">Transazioni</p>
              <p className="stat-card-value text-neutral-900">
                {summary?.transactionCount}
              </p>
            </div>
            <Activity className="icon-2xl text-neutral-600" />
          </div>
        </div>
      </div>

      {/* ── Proiezione ────────────────────────────────────────────────────── */}
      {activeProjectedBalance && (
        <ProjectedDetailCard
          projectedBalance={activeProjectedBalance}
          projectionMonths={projectionMonths}
          setProjectionMonths={(value) => setProjectionMonths(value)}
          setProjectionRange={(value) => {
            setProjectionMonths(0);
            setProjectionRange(value as { startDate: string; endDate: string });
          }}
        />
      )}

      {/* ── Grafici ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">

        {/* Bar Chart — Trend mensile */}
        <div className="card card-lg">
          <div className="flex items-center justify-between mb-4">
            <h2 className="card-header-title">Trend Mensile</h2>
            <div className="flex items-center gap-3 text-xs text-neutral-500">
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded-sm bg-success-500"></span> Entrate
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded-sm bg-danger-400"></span> Uscite
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

        {/* Donut Chart — Spese per categoria */}
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
                        fill={entry.categoryColor && entry.categoryColor !== '#gray'
                          ? entry.categoryColor
                          : CHART_COLORS[index % CHART_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomPieTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 overflow-hidden">
                <CustomPieLegend data={expenseCategoryStats} colors={CHART_COLORS} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Transazioni Recenti ───────────────────────────────────────────── */}
      <div className="card mb-8">
        <div className="card-header">
          <h2 className="card-header-title">Transazioni Recenti</h2>
        </div>
        <div className="card-divided">
          {recentTransactions.length === 0 ? (
            <div className="empty-state-card">
              <p className="empty-state-title">Nessuna transazione trovata</p>
            </div>
          ) : (
            recentTransactions.map((transaction) => (
              <div key={transaction.id} className="transaction-card">
                <div className="transaction-card-left">
                  <div className={
                    transaction.type === 'INCOME'
                      ? 'transaction-card-icon-income'
                      : 'transaction-card-icon-expense'
                  }>
                    {transaction.type === 'INCOME'
                      ? <TrendingUp className="icon-md text-success-600" />
                      : <TrendingDown className="icon-md text-danger-600" />}
                  </div>
                  <div className="transaction-card-info">
                    <p className="transaction-card-title">
                      {transaction.description || 'Nessuna descrizione'}
                    </p>
                    <p className="transaction-card-subtitle">
                      {transaction.category?.name || 'Senza categoria'} •{' '}
                      {format(new Date(transaction.date), 'dd MMM yyyy', { locale: it })}
                    </p>
                  </div>
                </div>
                <div className="transaction-card-right">
                  <span className={
                    transaction.type === 'INCOME'
                      ? 'transaction-amount-income'
                      : 'transaction-amount-expense'
                  }>
                    {transaction.type === 'INCOME' ? '+' : '-'}€{Number(transaction.amount).toFixed(2)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

    </div>
  );
}