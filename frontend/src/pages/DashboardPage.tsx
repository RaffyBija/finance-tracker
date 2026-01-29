import { useEffect, useState } from 'react';
import { dashboardAPI } from '../api/client.ts';
import type {
  Summary,
  CategoryStat,
  MonthlyTrend,
  Transaction,
  ProjectedBalance,
} from '../types';
import { TrendingUp, TrendingDown, Wallet, Activity } from 'lucide-react';
import {
  LineChart,
  Line,
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
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import ProjectedDetailCard from '../components/dashboard/ProjectedDetailCard.tsx';

export default function DashboardPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [categoryStats, setCategoryStats] = useState<CategoryStat[]>([]);
  const [monthlyTrend, setMonthlyTrend] = useState<MonthlyTrend[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [projectedBalance, setProjectedBalance] = useState<ProjectedBalance | null>(
    null
  );
  const [projectionMonths, setProjectionMonths] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  useEffect(() => {
    refreshProjectedBalance();
  }, [projectionMonths]);

  const refreshProjectedBalance = async () => {
    try {
      const [projectedData] = await Promise.all([
        dashboardAPI.getProjectedBalance(projectionMonths),
      ]);
      setProjectedBalance(projectedData);
    } catch (error) {
      console.error('Errore nel caricamento della dashboard:', error);
    }
  };

  const loadDashboardData = async () => {
    try {
      setIsLoading(true);
      const [summaryData, categoryData, trendData, recentData, projectedData] =
        await Promise.all([
          dashboardAPI.getSummary(),
          dashboardAPI.getCategoryStats(),
          dashboardAPI.getMonthlyTrend(6),
          dashboardAPI.getRecent(5),
          dashboardAPI.getProjectedBalance(projectionMonths),
        ]);
      setSummary(summaryData);
      setCategoryStats(categoryData);
      setMonthlyTrend(trendData);
      setRecentTransactions(recentData);
      setProjectedBalance(projectedData);
    } catch (error) {
      console.error('Errore nel caricamento della dashboard:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const COLORS = [
    '#0088FE',
    '#00C49F',
    '#FFBB28',
    '#FF8042',
    '#8884D8',
    '#82CA9D',
  ];

  if (isLoading) {
    return (
      <div className="flex-center h-64">
        <div className="skeleton skeleton-text w-32">Caricamento...</div>
      </div>
    );
  }

  return (
    <div className="container-custom">
      <h1 className="text-3xl font-bold text-neutral-900 mb-6">Dashboard</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* Entrate Card */}
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

        {/* Uscite Card */}
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

        {/* Saldo Card */}
        <div className="stat-card">
          <div className="flex-between">
            <div>
              <p className="stat-card-label">Saldo</p>
              <p
                className={`stat-card-value ${
                  summary && summary.balance >= 0
                    ? 'text-primary-600'
                    : 'text-danger-600'
                }`}
              >
                €{summary?.balance.toFixed(2)}
              </p>
            </div>
            <Wallet className="icon-2xl text-primary-600" />
          </div>
        </div>

        {/* Transazioni Card */}
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

      {/* Projection Details Card */}
      {projectedBalance && (
        <ProjectedDetailCard
          projectedBalance={projectedBalance}
          projectionMonths={projectionMonths}
          setProjectionMonths={(value) => {
            setProjectionMonths(value);
          }}
        />
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Trend mensile */}
        <div className="card card-lg">
          <h2 className="card-header-title mb-4">Trend Mensile</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={monthlyTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="income"
                stroke="#10B981"
                name="Entrate"
              />
              <Line
                type="monotone"
                dataKey="expense"
                stroke="#EF4444"
                name="Uscite"
              />
              <Line
                type="monotone"
                dataKey="balance"
                stroke="#3B82F6"
                name="Saldo"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Statistiche per categoria */}
        <div className="card card-lg">
          <h2 className="card-header-title mb-4">Spese per Categoria</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={categoryStats.filter((stat) => stat.type === 'EXPENSE')}
                cx="50%"
                cy="50%"
                labelLine={true}
                label={(entry) => entry.payload.categoryName}
                outerRadius={80}
                fill="#8884d8"
                dataKey="total"
              >
                {categoryStats
                  .filter((stat) => stat.type === 'EXPENSE')
                  .map((entry, index) => (
                    <Cell
                      key={`cell-${entry.categoryName}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Transazioni recenti */}
      <div className="card">
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
                  <div
                    className={
                      transaction.type === 'INCOME'
                        ? 'transaction-card-icon-income'
                        : 'transaction-card-icon-expense'
                    }
                  >
                    {transaction.type === 'INCOME' ? (
                      <TrendingUp className="icon-md text-success-600" />
                    ) : (
                      <TrendingDown className="icon-md text-danger-600" />
                    )}
                  </div>
                  <div className="transaction-card-info">
                    <p className="transaction-card-title">
                      {transaction.description || 'Nessuna descrizione'}
                    </p>
                    <p className="transaction-card-subtitle">
                      {transaction.category?.name || 'Senza categoria'} •{' '}
                      {format(new Date(transaction.date), 'dd MMM yyyy', {
                        locale: it,
                      })}
                    </p>
                  </div>
                </div>
                <div className="transaction-card-right">
                  <span
                    className={
                      transaction.type === 'INCOME'
                        ? 'transaction-card-amount-income'
                        : 'transaction-card-amount-expense'
                    }
                  >
                    {transaction.type === 'INCOME' ? '+' : '-'}€
                    {Number(transaction.amount).toFixed(2)}
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