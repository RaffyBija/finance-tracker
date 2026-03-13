import { useState, useMemo } from 'react';
import {
  useSummary,
  useCategoryStats,
  useMonthlyTrend,
  useRecentTransactions,
} from '../hooks/useDashboard';
import { TrendingUp, TrendingDown, Wallet, Activity, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns';
import { it } from 'date-fns/locale';
import ProjectedDetailCard from '../components/dashboard/ProjectedDetailCard';
import LoadingSpinner from '../components/shared/LoadingSpinner';

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

export default function DashboardPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const monthRange = useMemo(() => ({
    startDate: format(startOfMonth(currentMonth), 'yyyy-MM-dd'),
    endDate: format(endOfMonth(currentMonth), 'yyyy-MM-dd'),
  }), [currentMonth]);

  const isCurrentMonth = useMemo(() => {
    const now = new Date();
    return currentMonth.getMonth() === now.getMonth() &&
      currentMonth.getFullYear() === now.getFullYear();
  }, [currentMonth]);

  // Stato proiezione — rimane in DashboardPage per controllare ProjectedDetailCard
  const [projectionMonths, setProjectionMonths] = useState(1);
  const [projectionRange, setProjectionRange] = useState<object>({});

  // Solo le query che riguardano la dashboard principale
  const { data: summary, isLoading: summaryLoading } = useSummary(monthRange);
  const { data: totalSummary, isLoading: totalSummaryLoading } = useSummary();
  const { data: categoryStats = [], isLoading: statsLoading } = useCategoryStats(monthRange);
  const { data: monthlyTrend = [], isLoading: trendLoading } = useMonthlyTrend(6);
  const { data: recentTransactions = [], isLoading: recentLoading } = useRecentTransactions(5);

  // Le query di proiezione NON sono più qui — vivono dentro ProjectedDetailCard
  const isLoading = summaryLoading || totalSummaryLoading || statsLoading || trendLoading || recentLoading;

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

  if (isLoading) {
    return <LoadingSpinner message="Caricamento Dashboard ..." />;
  }

  return (
    <div className="container-custom">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900">Dashboard</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Analisi di{' '}
            <span className="font-semibold text-neutral-700">
              {format(currentMonth, 'MMMM yyyy', { locale: it })}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button onClick={() => setCurrentMonth((d) => subMonths(d, 1))} className="btn btn-ghost btn-sm">
            <ChevronLeft className="icon-sm" />
          </button>
          <span className="px-4 py-1.5 rounded-lg bg-neutral-100 text-sm font-semibold text-neutral-700 min-w-[130px] text-center capitalize">
            {format(currentMonth, 'MMMM yyyy', { locale: it })}
          </span>
          <button
            onClick={() => setCurrentMonth((d) => addMonths(d, 1))}
            disabled={isCurrentMonth}
            className="btn btn-ghost btn-sm disabled:opacity-40"
          >
            <ChevronRight className="icon-sm" />
          </button>
          {!isCurrentMonth && (
            <button onClick={() => setCurrentMonth(new Date())} className="btn btn-outline-primary btn-sm">
              Oggi
            </button>
          )}
        </div>
      </div>

      {/* ── Banner saldo attuale ── */}
      <div className="balance-hero mb-6">
        <div>
          <p className="balance-hero-label">Saldo attuale</p>
          <p className={`balance-hero-amount ${isPositive ? 'balance-hero-amount--positive' : 'balance-hero-amount--negative'}`}>
            {isPositive ? '+' : ''}€{totalBalance.toLocaleString('it-IT', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
          <p className="balance-hero-sub">Su tutte le transazioni registrate</p>
        </div>
        <Wallet className="balance-hero-icon" />
      </div>

      {/* ── Summary Cards mensili ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="stat-card">
          <div className="flex-between">
            <div>
              <p className="stat-card-label">Entrate</p>
              <p className="stat-card-value text-success-600">+€{summary?.income.toFixed(2)}</p>
            </div>
            <TrendingUp className="icon-2xl text-success-600" />
          </div>
        </div>
        <div className="stat-card">
          <div className="flex-between">
            <div>
              <p className="stat-card-label">Uscite</p>
              <p className="stat-card-value text-danger-600">-€{summary?.expense.toFixed(2)}</p>
            </div>
            <TrendingDown className="icon-2xl text-danger-600" />
          </div>
        </div>
        <div className="stat-card">
          <div className="flex-between">
            <div>
              <p className="stat-card-label">Saldo del mese</p>
              <p className={`stat-card-value ${summary && summary.balance >= 0 ? 'text-primary-600' : 'text-danger-600'}`}>
                {summary && summary.balance >= 0 ? '+' : ''}€{summary?.balance.toFixed(2)}
              </p>
            </div>
            <Wallet className="icon-2xl text-primary-600" />
          </div>
        </div>
        <div className="stat-card">
          <div className="flex-between">
            <div>
              <p className="stat-card-label">Transazioni</p>
              <p className="stat-card-value text-neutral-900">{summary?.transactionCount}</p>
            </div>
            <Activity className="icon-2xl text-neutral-600" />
          </div>
        </div>
      </div>

      {/* ── Proiezione — autonoma, gestisce il proprio loading ── */}
      <ProjectedDetailCard/>

      {/* ── Grafici ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
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
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(v) => `€${v}`} width={60} />
              <Tooltip content={<CustomBarTooltip />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
              <Bar dataKey="income" name="Entrate" fill="#10B981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expense" name="Uscite" fill="#EF4444" radius={[4, 4, 0, 0]} opacity={0.8} />
            </BarChart>
          </ResponsiveContainer>
        </div>

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
                  <Pie data={expenseCategoryStats} cx="50%" cy="50%" innerRadius={65} outerRadius={100} dataKey="total" nameKey="categoryName" paddingAngle={2}>
                    {expenseCategoryStats.map((entry, index) => (
                      <Cell key={`cell-${entry.categoryName}`} fill={getCategoryColor(entry, index)} />
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
      </div>

      {/* ── Transazioni Recenti ── */}
      <div className="card mb-8">
        <div className="card-header">
          <h2 className="card-header-title">Transazioni Recenti</h2>
        </div>
        <div className="card-divided">
          {recentTransactions.length === 0 ? (
            <div className="p-8 text-center text-neutral-400 text-sm">Nessuna transazione recente</div>
          ) : (
            recentTransactions.map((transaction) => (
              <div key={transaction.id} className="transaction-card">
                <div className="transaction-card-left min-w-0 flex-1">
                  <div className={transaction.type === 'INCOME' ? 'transaction-card-icon-income flex-shrink-0' : 'transaction-card-icon-expense flex-shrink-0'}>
                    {transaction.type === 'INCOME'
                      ? <TrendingUp className="icon-md text-success-600" />
                      : <TrendingDown className="icon-md text-danger-600" />
                    }
                  </div>
                  <div className="transaction-card-info min-w-0">
                    <p className="transaction-card-title truncate">{transaction.description || 'Nessuna descrizione'}</p>
                    <p className="transaction-card-subtitle truncate">
                      {transaction.category?.name || 'Senza categoria'} •{' '}
                      {format(new Date(transaction.date), 'dd MMM yyyy', { locale: it })}
                    </p>
                  </div>
                </div>
                <div className="transaction-card-right flex-shrink-0">
                  <span className={transaction.type === 'INCOME' ? 'transaction-card-amount-income' : 'transaction-card-amount-expense'}>
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