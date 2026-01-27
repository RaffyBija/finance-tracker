import { useEffect, useState } from 'react';
import { budgetApi } from '../api/budgets';
import { categoryAPI } from '../api/client';
import type { Budget, Category, CreateBudgetDTO, BudgetPeriod } from '../types';
import { Plus, Trash2, Pencil, AlertTriangle, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

export const Budgets = () => {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);

  const [formData, setFormData] = useState<CreateBudgetDTO>({
    name: '',
    amount: 0,
    categoryId: '',
    period: 'MONTHLY',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [budgetsData, categoriesData] = await Promise.all([
        budgetApi.getAll(),
        categoryAPI.getAll({ type: 'EXPENSE' }),
      ]);
      setBudgets(budgetsData);
      setCategories(categoriesData);
    } catch (error) {
      console.error('Errore nel caricamento:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingBudget) {
        await budgetApi.update(editingBudget.id, formData);
      } else {
        await budgetApi.create(formData);
      }
      setShowModal(false);
      resetForm();
      loadData();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Errore nel salvataggio');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Sei sicuro di voler eliminare questo budget?')) return;
    try {
      await budgetApi.delete(id);
      loadData();
    } catch (error) {
      alert('Errore nell\'eliminazione');
    }
  };

  const handleEdit = (budget: Budget) => {
    setEditingBudget(budget);
    setFormData({
      name: budget.name,
      amount: Number(budget.amount),
      categoryId: budget.categoryId || '',
      period: budget.period,
      startDate: budget.startDate.split('T')[0],
      endDate: budget.endDate ? budget.endDate.split('T')[0] : '',
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      amount: 0,
      categoryId: '',
      period: 'MONTHLY',
      startDate: new Date().toISOString().split('T')[0],
      endDate: '',
    });
    setEditingBudget(null);
  };

  const handleOpenModal = () => {
    resetForm();
    setShowModal(true);
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 100) return 'bg-red-500';
    if (percentage >= 80) return 'bg-orange-500';
    if (percentage >= 60) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getStatusIcon = (percentage: number) => {
    if (percentage >= 100) return <AlertTriangle className="w-5 h-5 text-red-500" />;
    if (percentage >= 80) return <AlertTriangle className="w-5 h-5 text-orange-500" />;
    return <CheckCircle className="w-5 h-5 text-green-500" />;
  };

  if (isLoading) {
    return <div className="flex justify-center items-center h-64">Caricamento...</div>;
  }

  return (
    <div className="px-4 sm:px-0">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Budget</h1>
        <button
          onClick={handleOpenModal}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Nuovo Budget
        </button>
      </div>

      {/* Lista Budget */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {budgets.length === 0 ? (
          <div className="col-span-full text-center py-12 text-gray-500">
            Nessun budget trovato
          </div>
        ) : (
          budgets.map((budget) => (
            <div key={budget.id} className="bg-white rounded-lg shadow-lg p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">{budget.name}</h3>
                  <p className="text-sm text-gray-500">
                    {budget.category?.name || 'Tutte le categorie'} • {budget.period}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {format(new Date(budget.startDate), 'dd MMM yyyy', { locale: it })}
                    {budget.endDate && ` - ${format(new Date(budget.endDate), 'dd MMM yyyy', { locale: it })}`}
                  </p>
                </div>
                <div className="flex gap-2">
                  {getStatusIcon(budget.percentage || 0)}
                  <button
                    onClick={() => handleEdit(budget)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(budget.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mb-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600">
                    Speso: €{budget.spent?.toFixed(2) || 0}
                  </span>
                  <span className="font-semibold">
                    {budget.percentage?.toFixed(1) || 0}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all ${getProgressColor(budget.percentage || 0)}`}
                    style={{ width: `${Math.min(budget.percentage || 0, 100)}%` }}
                  />
                </div>
              </div>

              {/* Importi */}
              <div className="flex justify-between items-center pt-4 border-t">
                <div>
                  <p className="text-xs text-gray-500">Budget</p>
                  <p className="text-lg font-bold text-gray-900">€{Number(budget.amount).toFixed(2)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">Rimanente</p>
                  <p className={`text-lg font-bold ${(budget.remaining || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    €{budget.remaining?.toFixed(2) || 0}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-2xl font-bold mb-4">
              {editingBudget ? 'Modifica Budget' : 'Nuovo Budget'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Nome</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Importo Budget (€)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) })}
                  className="w-full px-4 py-2 border rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Categoria (opzionale)</label>
                <select
                  value={formData.categoryId}
                  onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                >
                  <option value="">Tutte le spese</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Periodo</label>
                <select
                  value={formData.period}
                  onChange={(e) => setFormData({ ...formData, period: e.target.value as BudgetPeriod })}
                  className="w-full px-4 py-2 border rounded-lg"
                  required
                >
                  <option value="WEEKLY">Settimanale</option>
                  <option value="MONTHLY">Mensile</option>
                  <option value="YEARLY">Annuale</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Data Inizio</label>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Data Fine (opzionale)</label>
                <input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                />
              </div>
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); resetForm(); }}
                  className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Salva
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};