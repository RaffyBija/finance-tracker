import { useEffect, useState } from 'react';
import { plannedApi } from '../api/planned';
import {categoryAPI } from '../api/client';
import type { PlannedTransaction, Category, CreatePlannedTransactionDTO } from '../types';
import { Plus, Trash2, Pencil, TrendingUp, TrendingDown, CheckCircle2, Calendar, StickyNote } from 'lucide-react';
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
        filteredData = plannedData.filter(p => p.isPaid);
      } else if (filterStatus === 'UNPAID') {
        filteredData = plannedData.filter(p => !p.isPaid);
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
      alert('Errore nell\'eliminazione');
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

  const filteredCategories = categories.filter(cat => cat.type === formData.type);

  const getDateBadge = (date: string) => {
    const d = new Date(date);
    if (isToday(d)) return { text: 'Oggi', color: 'bg-red-100 text-red-700' };
    if (isTomorrow(d)) return { text: 'Domani', color: 'bg-orange-100 text-orange-700' };
    if (isPast(d)) return { text: 'Scaduto', color: 'bg-gray-300 text-gray-700' };
    return { text: format(d, 'dd MMM yyyy', { locale: it }), color: 'bg-blue-100 text-blue-700' };
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
    return <div className="flex justify-center items-center h-64">Caricamento...</div>;
  }

  return (
    <div className="px-4 sm:px-0">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Spese Pianificate</h1>
        <button
          onClick={handleOpenModal}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Nuova Spesa Pianificata
        </button>
      </div>

      {/* Filtri */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex gap-4">
          <button
            onClick={() => setFilterStatus('UNPAID')}
            className={`px-4 py-2 rounded-lg ${filterStatus === 'UNPAID' ? 'bg-orange-600 text-white' : 'bg-gray-100'}`}
          >
            Da Pagare
          </button>
          <button
            onClick={() => setFilterStatus('PAID')}
            className={`px-4 py-2 rounded-lg ${filterStatus === 'PAID' ? 'bg-green-600 text-white' : 'bg-gray-100'}`}
          >
            Pagate
          </button>
          <button
            onClick={() => setFilterStatus('ALL')}
            className={`px-4 py-2 rounded-lg ${filterStatus === 'ALL' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}
          >
            Tutte
          </button>
        </div>
      </div>

      {/* Lista Raggruppata */}
      <div className="space-y-6">
        {sortedDates.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
            Nessuna spesa pianificata trovata
          </div>
        ) : (
          sortedDates.map((date) => {
            const badge = getDateBadge(date);
            return (
              <div key={date} className="bg-white rounded-lg shadow overflow-hidden">
                <div className="bg-gray-50 px-6 py-3 border-b flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-gray-600" />
                  <span className="font-semibold text-gray-900">
                    {format(new Date(date), 'EEEE, dd MMMM yyyy', { locale: it })}
                  </span>
                  <span className={`text-xs px-2 py-1 rounded ${badge.color}`}>
                    {badge.text}
                  </span>
                </div>
                <div className="divide-y">
                  {groupedPlanned[date].map((p) => (
                    <div key={p.id} className="p-4 hover:bg-gray-50">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4 flex-1">
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                            p.type === 'INCOME' ? 'bg-green-100' : 'bg-red-100'
                          } ${p.isPaid ? 'opacity-50' : ''}`}>
                            {p.type === 'INCOME' ? (
                              <TrendingUp className="w-6 h-6 text-green-600" />
                            ) : (
                              <TrendingDown className="w-6 h-6 text-red-600" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className={`font-semibold text-lg ${p.isPaid ? 'line-through text-gray-400' : ''}`}>
                                {p.description}
                              </h3>
                              {p.isPaid && (
                                <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded">
                                  Pagato
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-500">
                              {p.category?.name || 'Senza categoria'}
                            </p>
                            {p.notes && (
                              <div className="flex items-start gap-2 mt-2 text-sm text-gray-600 bg-gray-50 p-2 rounded">
                                <StickyNote className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                <p>{p.notes}</p>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-4 ml-4">
                          <span className={`text-xl font-bold ${
                            p.type === 'INCOME' ? 'text-green-600' : 'text-red-600'
                          } ${p.isPaid ? 'line-through text-gray-400' : ''}`}>
                            {p.type === 'INCOME' ? '+' : '-'}€{Number(p.amount).toFixed(2)}
                          </span>
                          {!p.isPaid && (
                            <button
                              onClick={() => handleMarkAsPaid(p.id)}
                              className="p-2 text-green-600 hover:bg-green-50 rounded"
                              title="Segna come pagato"
                            >
                              <CheckCircle2 className="w-5 h-5" />
                            </button>
                          )}
                          <button
                            onClick={() => handleEdit(p)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(p.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">
              {editingPlanned ? 'Modifica Spesa Pianificata' : 'Nuova Spesa Pianificata'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Tipo</label>
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, type: 'INCOME', categoryId: '' })}
                    className={`flex-1 py-2 rounded ${formData.type === 'INCOME' ? 'bg-green-600 text-white' : 'bg-gray-100'}`}
                  >
                    Entrata
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, type: 'EXPENSE', categoryId: '' })}
                    className={`flex-1 py-2 rounded ${formData.type === 'EXPENSE' ? 'bg-red-600 text-white' : 'bg-gray-100'}`}
                  >
                    Uscita
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Descrizione</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                  required
                  placeholder="Es. Meccanico, Dentista, Regalo..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Importo (€)</label>
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
                <label className="block text-sm font-medium mb-2">Categoria</label>
                <select
                  value={formData.categoryId}
                  onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                >
                  <option value="">Nessuna categoria</option>
                  {filteredCategories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Data Prevista</label>
                <input
                  type="date"
                  value={formData.plannedDate}
                  onChange={(e) => setFormData({ ...formData, plannedDate: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Note (opzionali)</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                  rows={3}
                  placeholder="Dettagli aggiuntivi..."
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