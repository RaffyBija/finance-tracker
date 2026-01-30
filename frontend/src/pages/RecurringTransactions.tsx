import { useEffect, useState } from 'react';
import { recurringApi } from '../api/recurring';
import { categoryAPI } from '../api/client';
import type {
  RecurringTransaction,
  Category,
  CreateRecurringTransactionDTO,
  Frequency,
} from '../types';
import { Plus, Trash2, Pencil, TrendingUp, TrendingDown, Power, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

import Loading from '../components/layout/Loading';


export const RecurringTransactions = () => {
  const [recurring, setRecurring] = useState<RecurringTransaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingRecurring, setEditingRecurring] = useState<RecurringTransaction | null>(null);

  const [formData, setFormData] = useState<CreateRecurringTransactionDTO>({
    amount: 0,
    type: 'EXPENSE',
    description: '',
    categoryId: '',
    frequency: 'MONTHLY',
    dayOfMonth: 1,
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [recurringData, categoriesData] = await Promise.all([
        recurringApi.getAll(),
        categoryAPI.getAll(),
      ]);
      setRecurring(recurringData);
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
      if (editingRecurring) {
        await recurringApi.update(editingRecurring.id, formData);
      } else {
        await recurringApi.create(formData);
      }
      setShowModal(false);
      resetForm();
      loadData();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Errore nel salvataggio');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Sei sicuro di voler eliminare questa spesa ricorrente?')) return;
    try {
      await recurringApi.delete(id);
      loadData();
    } catch (error) {
      alert("Errore nell'eliminazione");
    }
  };

  const handleToggle = async (id: string) => {
    try {
      await recurringApi.toggle(id);
      loadData();
    } catch (error) {
      alert('Errore nel cambio stato');
    }
  };

  const handleEdit = (rec: RecurringTransaction) => {
    setEditingRecurring(rec);
    setFormData({
      amount: Number(rec.amount),
      type: rec.type,
      description: rec.description,
      categoryId: rec.categoryId || '',
      frequency: rec.frequency,
      dayOfMonth: rec.dayOfMonth || 1,
      startDate: rec.startDate.split('T')[0],
      endDate: rec.endDate ? rec.endDate.split('T')[0] : '',
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData({
      amount: 0,
      type: 'EXPENSE',
      description: '',
      categoryId: '',
      frequency: 'MONTHLY',
      dayOfMonth: 1,
      startDate: new Date().toISOString().split('T')[0],
      endDate: '',
    });
    setEditingRecurring(null);
  };

  const handleOpenModal = () => {
    resetForm();
    setShowModal(true);
  };

  const filteredCategories = categories.filter((cat) => cat.type === formData.type);

  const getFrequencyLabel = (freq: Frequency, dayOfMonth?: number) => {
    switch (freq) {
      case 'WEEKLY':
        return 'Settimanale';
      case 'MONTHLY':
        return `Ogni ${dayOfMonth} del mese`;
      case 'YEARLY':
        return 'Annuale';
      default:
        return freq;
    }
  };

  if (isLoading) {
    return (
     <Loading />
    );
  }

  return (
    <div className="container-custom">
      <div className="flex-between mb-6">
        <h1 className="text-3xl font-bold text-neutral-900">Spese Ricorrenti</h1>
        <button onClick={handleOpenModal} className="btn btn-primary btn-md">
          <Plus className="icon-md" />
          Nuova Spesa Ricorrente
        </button>
      </div>

      {/* Lista Recurring */}
      <div className="list-card">
        {recurring.length === 0 ? (
          <div className="empty-state-card">
            <p className="empty-state-title">Nessuna spesa ricorrente trovata</p>
            <p className="empty-state-description">
              Crea la tua prima spesa ricorrente per monitorare entrate/uscite fisse
            </p>
            <button onClick={handleOpenModal} className="btn btn-primary btn-md">
              <Plus className="icon-md" />
              Crea Spesa Ricorrente
            </button>
          </div>
        ) : (
          recurring.map((rec) => (
            <div key={rec.id} className="list-card-item">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start sm:items-center gap-4 flex-1 min-w-0">
                  <div
                    className={`w-12 h-12 rounded-full flex-center flex-shrink-0 ${
                      rec.type === 'INCOME' ? 'bg-success-100' : 'bg-danger-100'
                    }`}
                  >
                    {rec.type === 'INCOME' ? (
                      <TrendingUp className="icon-lg text-success-600" />
                    ) : (
                      <TrendingDown className="icon-lg text-danger-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-lg truncate">{rec.description}</h3>
                      <span
                        className={`${
                          rec.isActive ? 'badge-status-active' : 'badge-status-inactive'
                        }`}
                      >
                        {rec.isActive ? 'Attivo' : 'Inattivo'}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-sm text-neutral-500 mt-1">
                      <span>{rec.category?.name || 'Senza categoria'}</span>
                      <span>•</span>
                      <div className="flex items-center gap-1">
                        <Calendar className="icon-sm" />
                        {getFrequencyLabel(rec.frequency, rec.dayOfMonth)}
                      </div>
                    </div>
                    <p className="text-xs text-neutral-400 mt-1">
                      Dal{' '}
                      {format(new Date(rec.startDate), 'dd MMM yyyy', { locale: it })}
                      {rec.endDate &&
                        ` al ${format(new Date(rec.endDate), 'dd MMM yyyy', {
                          locale: it,
                        })}`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 sm:gap-4 flex-wrap sm:flex-nowrap">
                  <span
                    className={`text-xl font-bold whitespace-nowrap ${
                      rec.type === 'INCOME' ? 'text-success-600' : 'text-danger-600'
                    }`}
                  >
                    {rec.type === 'INCOME' ? '+' : '-'}€{Number(rec.amount).toFixed(2)}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggle(rec.id)}
                      className={`btn-icon ${
                        rec.isActive ? 'text-success-600 hover:bg-success-50' : 'btn-icon-neutral'
                      }`}
                      title={rec.isActive ? 'Disattiva' : 'Attiva'}
                    >
                      <Power className="icon-md" />
                    </button>
                    <button onClick={() => handleEdit(rec)} className="btn-icon-primary">
                      <Pencil className="icon-sm" />
                    </button>
                    <button onClick={() => handleDelete(rec.id)} className="btn-icon-danger">
                      <Trash2 className="icon-sm" />
                    </button>
                  </div>
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
            className="card card-lg w-full max-w-md max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="card-header-title mb-4">
              {editingRecurring ? 'Modifica Spesa Ricorrente' : 'Nuova Spesa Ricorrente'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="form-group">
                <label className="form-label">Tipo</label>
                <div className="form-button-group">
                  <button
                    type="button"
                    onClick={() =>
                      setFormData({ ...formData, type: 'INCOME', categoryId: '' })
                    }
                    className={`btn-toggle flex-1 ${
                      formData.type === 'INCOME'
                        ? 'btn-toggle-income-active'
                        : 'btn-toggle-inactive'
                    }`}
                  >
                    Entrata
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setFormData({ ...formData, type: 'EXPENSE', categoryId: '' })
                    }
                    className={`btn-toggle flex-1 ${
                      formData.type === 'EXPENSE'
                        ? 'btn-toggle-expense-active'
                        : 'btn-toggle-inactive'
                    }`}
                  >
                    Uscita
                  </button>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Descrizione</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className="form-input"
                  required
                  placeholder="Es. Affitto, Stipendio, Bolletta..."
                />
              </div>
              <div className="form-group">
                <label className="form-label">Importo (€)</label>
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
                <label className="form-label">Categoria</label>
                <select
                  value={formData.categoryId}
                  onChange={(e) =>
                    setFormData({ ...formData, categoryId: e.target.value })
                  }
                  className="form-select"
                >
                  <option value="">Nessuna categoria</option>
                  {filteredCategories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Frequenza</label>
                <select
                  value={formData.frequency}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      frequency: e.target.value as Frequency,
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
              {formData.frequency === 'MONTHLY' && (
                <div className="form-group">
                  <label className="form-label">Giorno del Mese (1-31)</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={formData.dayOfMonth}
                    onChange={(e) =>
                      setFormData({ ...formData, dayOfMonth: parseInt(e.target.value) })
                    }
                    className="form-input"
                    required
                  />
                </div>
              )}
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
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
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