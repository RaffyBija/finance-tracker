import { useEffect, useState } from 'react';
import { dashboardAPI } from '../api/client.ts';
import type { Summary, CategoryStat, MonthlyTrend, Transaction, ProjectedBalance } from '../types';
import { TrendingUp, TrendingDown, Wallet, Activity } from 'lucide-react';
import { LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns'; 
import { it } from 'date-fns/locale';
import ProjectedDetailCard from '../components/dashboard/ProjectedDetailCard.tsx';


export default function DashboardPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [categoryStats, setCategoryStats] = useState<CategoryStat[]>([]);
  const [monthlyTrend, setMonthlyTrend] = useState<MonthlyTrend[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [projectedBalance, setProjectedBalance] = useState<ProjectedBalance | null>(null);
  const [projectionMonths, setProjectionMonths] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  useEffect(()=>{
    refreshProjectedBalance();
  },[projectionMonths]);

  const refreshProjectedBalance = async () =>{
    try{
      const [projectedData] = await Promise.all([
        dashboardAPI.getProjectedBalance(projectionMonths)
      ]);
      setProjectedBalance(projectedData);
    }catch(error){
      console.error('Errore nel caricamento della dashboard:', error)
    }
  }

  const loadDashboardData = async () => {
    try {
      setIsLoading(true);
      const [summaryData, categoryData, trendData, recentData, projectedData] = await Promise.all([
        dashboardAPI.getSummary(),
        dashboardAPI.getCategoryStats(),
        dashboardAPI.getMonthlyTrend(6),
        dashboardAPI.getRecent(5),
        dashboardAPI.getProjectedBalance(projectionMonths)
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

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-600">Caricamento...</div>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-0">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Dashboard</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Entrate</p>
              <p className="text-2xl font-bold text-green-600">
                €{summary?.income.toFixed(2)}
              </p>
            </div>
            <TrendingUp className="w-10 h-10 text-green-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Uscite</p>
              <p className="text-2xl font-bold text-red-600">
                €{summary?.expense.toFixed(2)}
              </p>
            </div>
            <TrendingDown className="w-10 h-10 text-red-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Saldo</p>
              <p className={`text-2xl font-bold ${summary && summary.balance >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                €{summary?.balance.toFixed(2)}
              </p>
            </div>
            <Wallet className="w-10 h-10 text-blue-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Transazioni</p>
              <p className="text-2xl font-bold text-gray-900">
                {summary?.transactionCount}
              </p>
            </div>
            <Activity className="w-10 h-10 text-gray-600" />
          </div>
        </div>
      </div>

      {/* Projection Details Card */}
      {projectedBalance && (
        <ProjectedDetailCard
        projectedBalance={projectedBalance}
        projectionMonths={projectionMonths}
        setProjectionMonths={(value)=>{setProjectionMonths(value)}}
        >


        </ProjectedDetailCard>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Trend mensile */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Trend Mensile</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={monthlyTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="income" stroke="#10B981" name="Entrate" />
              <Line type="monotone" dataKey="expense" stroke="#EF4444" name="Uscite" />
              <Line type="monotone" dataKey="balance" stroke="#3B82F6" name="Saldo" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Statistiche per categoria */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Spese per Categoria</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={categoryStats.filter(stat => stat.type === 'EXPENSE')}
                cx="50%"
                cy="50%"
                labelLine={true}
                label={(entry) => entry.payload.categoryName}
                outerRadius={80}
                fill="#8884d8"
                dataKey="total"
              >
                {categoryStats.filter(stat => stat.type === 'EXPENSE').map((entry, index) => (
                  <Cell key={`cell-${entry.categoryName}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Transazioni recenti */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold">Transazioni Recenti</h2>
        </div>
        <div className="divide-y divide-gray-200">
          {recentTransactions.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500">
              Nessuna transazione trovata
            </div>
          ) : (
            recentTransactions.map((transaction) => (
              <div key={transaction.id} className="px-6 py-4 flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    transaction.type === 'INCOME' ? 'bg-green-100' : 'bg-red-100'
                  }`}>
                    {transaction.type === 'INCOME' ? (
                      <TrendingUp className="w-5 h-5 text-green-600" />
                    ) : (
                      <TrendingDown className="w-5 h-5 text-red-600" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {transaction.description || 'Nessuna descrizione'}
                    </p>
                    <p className="text-sm text-gray-500">
                      {transaction.category?.name || 'Senza categoria'} • {' '}
                      {format(new Date(transaction.date), 'dd MMM yyyy', { locale: it })}
                    </p>
                  </div>
                </div>
                <div className={`text-lg font-semibold ${
                  transaction.type === 'INCOME' ? 'text-green-600' : 'text-red-600'
                }`}>
                  {transaction.type === 'INCOME' ? '+' : '-'}€{Number(transaction.amount).toFixed(2)}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      
    </div>
  );
};