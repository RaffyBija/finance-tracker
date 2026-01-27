import { useEffect, useState } from 'react';
import { recurringApi } from '../api/recurring';
import { categoryAPI } from '../api/client';
import type { RecurringTransaction, Category, CreateRecurringTransactionDTO, Frequency } from '../types';
import { Plus, Trash2, Pencil, TrendingUp, TrendingDown, Power, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

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
      alert('Errore nell\'eliminazione');
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

  const filteredCategories = categories.filter(cat => cat.type === formData.type);

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
    return <div className="flex justify-center items-center h-64">Caricamento...</div>;
  }

  return (
    <div className="px-4 sm:px-0">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Spese Ricorrenti</h1>
        <button
          onClick={handleOpenModal}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Nuova Spesa Ricorrente
        </button>
      </div>

      {/* Lista Recurring */}
      <div className="bg-white rounded-lg shadow divide-y">
        {recurring.length === 0 ? (
          <div className="p-8 text-center text-gray-500">Nessuna spesa ricorrente trovata</div>
        ) : (
          recurring.map((rec) => (
            <div key={rec.id} className="p-4 hover:bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 flex-1">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                    rec.type === 'INCOME' ? 'bg-green-100' : 'bg-red-100'
                  }`}>
                    {rec.type === 'INCOME' ? (
                      <TrendingUp className="w-6 h-6 text-green-600" />
                    ) : (
                      <TrendingDown className="w-6 h-6 text-red-600" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-lg">{rec.description}</h3>
                      <span className={`px-2 py-1 rounded text-xs ${
                        rec.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {rec.isActive ? 'Attivo' : 'Inattivo'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
                      <span>{rec.category?.name || 'Senza categoria'}</span>
                      <span>•</span>
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {getFrequencyLabel(rec.frequency, rec.dayOfMonth)}
                      </div>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      Dal {format(new Date(rec.startDate), 'dd MMM yyyy', { locale: it })}
                      {rec.endDate && ` al ${format(new Date(rec.endDate), 'dd MMM yyyy', { locale: it })}`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <span className={`text-xl font-bold ${
                    rec.type === 'INCOME' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {rec.type === 'INCOME' ? '+' : '-'}€{Number(rec.amount).toFixed(2)}
                  </span>
                  <button
                    onClick={() => handleToggle(rec.id)}
                    className={`p-2 rounded ${rec.isActive ? 'text-green-600 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-100'}`}
                    title={rec.isActive ? 'Disattiva' : 'Attiva'}
                  >
                    <Power className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleEdit(rec)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(rec.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">
              {editingRecurring ? 'Modifica Spesa Ricorrente' : 'Nuova Spesa Ricorrente'}
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
                  placeholder="Es. Affitto, Stipendio, Bolletta..."
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
                <label className="block text-sm font-medium mb-2">Frequenza</label>
                <select
                  value={formData.frequency}
                  onChange={(e) => setFormData({ ...formData, frequency: e.target.value as Frequency })}
                  className="w-full px-4 py-2 border rounded-lg"
                  required
                >
                  <option value="WEEKLY">Settimanale</option>
                  <option value="MONTHLY">Mensile</option>
                  <option value="YEARLY">Annuale</option>
                </select>
              </div>
              {formData.frequency === 'MONTHLY' && (
                <div>
                  <label className="block text-sm font-medium mb-2">Giorno del Mese (1-31)</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={formData.dayOfMonth}
                    onChange={(e) => setFormData({ ...formData, dayOfMonth: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 border rounded-lg"
                    required
                  />
                </div>
              )}
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