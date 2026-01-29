import { useEffect, useState } from 'react';
import { plannedApi } from '../api/planned';
import { categoryAPI } from '../api/client';
import type { PlannedTransaction, Category, CreatePlannedTransactionDTO } from '../types';
import {
  Plus,
  Trash2,
  Pencil,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  Calendar,
  StickyNote,
} from 'lucide-react';
import { format, isPast, isToday, isTomorrow } from 'date-fns';
import { it } from 'date-fns/locale';

export const PlannedTransactions = () => {
  const [planned, setPlanned] = useState<PlannedTransaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPlanned, setEditingPlanned] = useState<PlannedTransaction | null>(null);
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'UNPAID' | 'PAID'>('UNPAID');

  const [formData, setFormData] = useState<CreatePlannedTransactionDTO>({
    amount: 0,
    type: 'EXPENSE',
    description: '',
    categoryId: '',
    plannedDate: new Date().toISOString().split('T')[0],
    notes: '',
  });

  useEffect(() => {
    loadData();
  }, [filterStatus]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const params = filterStatus === 'UNPAID' ? { unpaidOnly: true } : {};
      const [plannedData, categoriesData] = await Promise.all([
        plannedApi.getAll(params),
        categoryAPI.getAll(),
      ]);

      // Filtra in base allo stato
      let filteredData = plannedData;
      if (filterStatus === 'PAID') {
        filteredData = plannedData.filter((p) => p.isPaid);
      } else if (filterStatus === 'UNPAID') {
        filteredData = plannedData.filter((p) => !p.isPaid);
      }

      setPlanned(filteredData);
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
      if (editingPlanned) {
        await plannedApi.update(editingPlanned.id, formData);
      } else {
        await plannedApi.create(formData);
      }
      setShowModal(false);
      resetForm();
      loadData();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Errore nel salvataggio');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Sei sicuro di voler eliminare questa spesa pianificata?')) return;
    try {
      await plannedApi.delete(id);
      loadData();
    } catch (error) {
      alert("Errore nell'eliminazione");
    }
  };

  const handleMarkAsPaid = async (id: string) => {
    if (!confirm('Segnare come pagato? Verrà creata una transazione reale.')) return;
    try {
      await plannedApi.markAsPaid(id);
      loadData();
    } catch (error) {
      alert('Errore nel salvataggio');
    }
  };

  const handleEdit = (p: PlannedTransaction) => {
    setEditingPlanned(p);
    setFormData({
      amount: Number(p.amount),
      type: p.type,
      description: p.description,
      categoryId: p.categoryId || '',
      plannedDate: p.plannedDate.split('T')[0],
      notes: p.notes || '',
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData({
      amount: 0,
      type: 'EXPENSE',
      description: '',
      categoryId: '',
      plannedDate: new Date().toISOString().split('T')[0],
      notes: '',
    });
    setEditingPlanned(null);
  };

  const handleOpenModal = () => {
    resetForm();
    setShowModal(true);
  };

  const filteredCategories = categories.filter((cat) => cat.type === formData.type);

  const getDateBadge = (date: string) => {
    const d = new Date(date);
    if (isToday(d)) return { text: 'Oggi', className: 'badge-date-today' };
    if (isTomorrow(d)) return { text: 'Domani', className: 'badge-date-tomorrow' };
    if (isPast(d)) return { text: 'Scaduto', className: 'badge-date-past' };
    return {
      text: format(d, 'dd MMM yyyy', { locale: it }),
      className: 'badge-date-upcoming',
    };
  };

  // Raggruppa per data
  const groupedPlanned = planned.reduce((groups, p) => {
    const date = p.plannedDate.split('T')[0];
    if (!groups[date]) groups[date] = [];
    groups[date].push(p);
    return groups;
  }, {} as Record<string, PlannedTransaction[]>);

  const sortedDates = Object.keys(groupedPlanned).sort();

  if (isLoading) {
    return (
      <div className="flex-center h-64">
        <div className="skeleton skeleton-text w-32">Caricamento...</div>
      </div>
    );
  }

  return (
    <div className="container-custom">
      <div className="flex-between mb-6">
        <h1 className="text-3xl font-bold text-neutral-900">Spese Pianificate</h1>
        <button onClick={handleOpenModal} className="btn btn-primary btn-md">
          <Plus className="icon-md" />
          Nuova Spesa Pianificata
        </button>
      </div>

      {/* Filtri */}
      <div className="card card-md mb-6">
        <div className="flex flex-wrap gap-2 sm:gap-4">
          <button
            onClick={() => setFilterStatus('UNPAID')}
            className={`btn-filter flex-1 sm:flex-initial ${
              filterStatus === 'UNPAID' ? 'bg-warning-600 text-white' : 'btn-filter-inactive'
            }`}
          >
            Da Pagare
          </button>
          <button
            onClick={() => setFilterStatus('PAID')}
            className={`btn-filter flex-1 sm:flex-initial ${
              filterStatus === 'PAID' ? 'btn-filter-income-active' : 'btn-filter-inactive'
            }`}
          >
            Pagate
          </button>
          <button
            onClick={() => setFilterStatus('ALL')}
            className={`btn-filter flex-1 sm:flex-initial ${
              filterStatus === 'ALL' ? 'btn-filter-all-active' : 'btn-filter-inactive'
            }`}
          >
            Tutte
          </button>
        </div>
      </div>

      {/* Lista Raggruppata */}
      <div className="space-y-6">
        {sortedDates.length === 0 ? (
          <div className="empty-state-card">
            <p className="empty-state-title">Nessuna spesa pianificata trovata</p>
            <p className="empty-state-description">
              Crea la tua prima spesa pianificata per organizzare i pagamenti futuri
            </p>
            <button onClick={handleOpenModal} className="btn btn-primary btn-md">
              <Plus className="icon-md" />
              Crea Spesa Pianificata
            </button>
          </div>
        ) : (
          sortedDates.map((date) => {
            const badge = getDateBadge(date);
            return (
              <div key={date} className="card">
                <div className="card-header flex items-center gap-3">
                  <Calendar className="icon-md text-neutral-600" />
                  <span className="font-semibold text-neutral-900">
                    {format(new Date(date), 'EEEE, dd MMMM yyyy', { locale: it })}
                  </span>
                  <span className={badge.className}>{badge.text}</span>
                </div>
                <div className="card-divided">
                  {groupedPlanned[date].map((p) => (
                    <div key={p.id} className="list-card-item">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                        <div className="flex items-start gap-4 flex-1 min-w-0">
                          <div
                            className={`w-12 h-12 rounded-full flex-center flex-shrink-0 ${
                              p.type === 'INCOME' ? 'bg-success-100' : 'bg-danger-100'
                            } ${p.isPaid ? 'opacity-50' : ''}`}
                          >
                            {p.type === 'INCOME' ? (
                              <TrendingUp className="icon-lg text-success-600" />
                            ) : (
                              <TrendingDown className="icon-lg text-danger-600" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3
                                className={`font-semibold text-lg truncate ${
                                  p.isPaid ? 'line-through text-neutral-400' : ''
                                }`}
                              >
                                {p.description}
                              </h3>
                              {p.isPaid && <span className="badge-paid">Pagato</span>}
                            </div>
                            <p className="text-sm text-neutral-500">
                              {p.category?.name || 'Senza categoria'}
                            </p>
                            {p.notes && (
                              <div className="flex items-start gap-2 mt-2 text-sm text-neutral-600 bg-neutral-50 p-2 rounded">
                                <StickyNote className="icon-sm mt-0.5 flex-shrink-0" />
                                <p>{p.notes}</p>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 sm:gap-4 flex-wrap sm:flex-nowrap sm:ml-4">
                          <span
                            className={`text-xl font-bold whitespace-nowrap ${
                              p.type === 'INCOME' ? 'text-success-600' : 'text-danger-600'
                            } ${p.isPaid ? 'line-through text-neutral-400' : ''}`}
                          >
                            {p.type === 'INCOME' ? '+' : '-'}€{Number(p.amount).toFixed(2)}
                          </span>
                          <div className="flex items-center gap-2">
                            {!p.isPaid && (
                              <button
                                onClick={() => handleMarkAsPaid(p.id)}
                                className="btn-icon text-success-600 hover:bg-success-50"
                                title="Segna come pagato"
                              >
                                <CheckCircle2 className="icon-md" />
                              </button>
                            )}
                            <button onClick={() => handleEdit(p)} className="btn-icon-primary">
                              <Pencil className="icon-sm" />
                            </button>
                            <button onClick={() => handleDelete(p.id)} className="btn-icon-danger">
                              <Trash2 className="icon-sm" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })
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
              {editingPlanned ? 'Modifica Spesa Pianificata' : 'Nuova Spesa Pianificata'}
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
                  placeholder="Es. Meccanico, Dentista, Regalo..."
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
                <label className="form-label">Data Prevista</label>
                <input
                  type="date"
                  value={formData.plannedDate}
                  onChange={(e) =>
                    setFormData({ ...formData, plannedDate: e.target.value })
                  }
                  className="form-input"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Note (opzionali)</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="form-textarea"
                  rows={3}
                  placeholder="Dettagli aggiuntivi..."
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