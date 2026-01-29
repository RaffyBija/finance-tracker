import { useEffect, useState } from 'react';
import { budgetApi } from '../api/budgets';
import { categoryAPI } from '../api/client';
import type { Budget, Category, CreateBudgetDTO, BudgetPeriod } from '../types';
import { Plus, Trash2, Pencil, AlertTriangle, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import {OrbitProgress} from 'react-loading-indicators'

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
      alert("Errore nell'eliminazione");
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
    if (percentage >= 100) return 'bg-danger-500';
    if (percentage >= 80) return 'bg-warning-500';
    if (percentage >= 60) return 'bg-warning-400';
    return 'bg-success-500';
  };

  const getStatusIcon = (percentage: number) => {
    if (percentage >= 100)
      return <AlertTriangle className="icon-md text-danger-500" />;
    if (percentage >= 80)
      return <AlertTriangle className="icon-md text-warning-500" />;
    return <CheckCircle className="icon-md text-success-500" />;
  };

  if (isLoading) {
    return (
      <div className='flex items-center justify-center'>
        <OrbitProgress variant="split-disc" color="#3161cc" size="large" text="" textColor="" />
      </div>
    );
  }

  return (
    <div className="container-custom">
      <div className="flex-between mb-6">
        <h1 className="text-3xl font-bold text-neutral-900">Budget</h1>
        <button onClick={handleOpenModal} className="btn btn-primary btn-md">
          <Plus className="icon-md" />
          Nuovo Budget
        </button>
      </div>

      {/* Lista Budget */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {budgets.length === 0 ? (
          <div className="empty-state-card col-span-full">
            <p className="empty-state-title">Nessun budget trovato</p>
            <p className="empty-state-description">
              Crea il tuo primo budget per monitorare le spese
            </p>
            <button onClick={handleOpenModal} className="btn btn-primary btn-md">
              <Plus className="icon-md" />
              Crea Budget
            </button>
          </div>
        ) : (
          budgets.map((budget) => (
            <div key={budget.id} className="budget-card">
              <div className="budget-card-header">
                <div>
                  <h3 className="budget-card-title">{budget.name}</h3>
                  <p className="budget-card-subtitle">
                    {budget.category?.name || 'Tutte le categorie'} • {budget.period}
                  </p>
                  <p className="text-xs text-neutral-400 mt-1">
                    {format(new Date(budget.startDate), 'dd MMM yyyy', { locale: it })}
                    {budget.endDate &&
                      ` - ${format(new Date(budget.endDate), 'dd MMM yyyy', {
                        locale: it,
                      })}`}
                  </p>
                </div>
                <div className="flex gap-2">
                  {getStatusIcon(budget.percentage || 0)}
                  <button
                    onClick={() => handleEdit(budget)}
                    className="btn-icon-primary"
                  >
                    <Pencil className="icon-sm" />
                  </button>
                  <button
                    onClick={() => handleDelete(budget.id)}
                    className="btn-icon-danger"
                  >
                    <Trash2 className="icon-sm" />
                  </button>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="budget-card-progress">
                <div className="flex-between text-sm mb-2">
                  <span className="text-neutral-600">
                    Speso: €{budget.spent?.toFixed(2) || 0}
                  </span>
                  <span className="font-semibold">
                    {budget.percentage?.toFixed(1) || 0}%
                  </span>
                </div>
                <div className="budget-card-progress-bar">
                  <div
                    className={`budget-card-progress-fill ${getProgressColor(
                      budget.percentage || 0
                    )}`}
                    style={{
                      width: `${Math.min(budget.percentage || 0, 100)}%`,
                    }}
                  />
                </div>
              </div>

              {/* Importi */}
              <div className="budget-card-stats">
                <div>
                  <p className="text-xs text-neutral-500">Budget</p>
                  <p className="text-lg font-bold text-neutral-900">
                    €{Number(budget.amount).toFixed(2)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-neutral-500">Rimanente</p>
                  <p
                    className={`text-lg font-bold ${
                      (budget.remaining || 0) >= 0
                        ? 'text-success-600'
                        : 'text-danger-600'
                    }`}
                  >
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
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div
            className="card card-lg w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="card-header-title mb-4">
              {editingBudget ? 'Modifica Budget' : 'Nuovo Budget'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="form-group">
                <label className="form-label">Nome</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="form-input"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Importo Budget (€)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) =>
                    setFormData({ ...formData, amount: parseFloat(e.target.value) })
                  }
                  className="form-input"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Categoria (opzionale)</label>
                <select
                  value={formData.categoryId}
                  onChange={(e) =>
                    setFormData({ ...formData, categoryId: e.target.value })
                  }
                  className="form-select"
                >
                  <option value="">Tutte le spese</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Periodo</label>
                <select
                  value={formData.period}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      period: e.target.value as BudgetPeriod,
                    })
                  }
                  className="form-select"
                  required
                >
                  <option value="WEEKLY">Settimanale</option>
                  <option value="MONTHLY">Mensile</option>
                  <option value="YEARLY">Annuale</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Data Inizio</label>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) =>
                    setFormData({ ...formData, startDate: e.target.value })
                  }
                  className="form-input"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Data Fine (opzionale)</label>
                <input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) =>
                    setFormData({ ...formData, endDate: e.target.value })
                  }
                  className="form-input"
                />
              </div>
              <div className="form-button-group">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="btn btn-secondary flex-1"
                >
                  Annulla
                </button>
                <button type="submit" className="btn btn-primary flex-1">
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