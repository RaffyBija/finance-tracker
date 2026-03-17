import { useState, useEffect } from 'react';
import BaseModal from '../layout/ModalBase';
import { InputDecimal } from '../layout/InputNumberDecimal';
import { useCreateRecurring, useUpdateRecurring } from '../../hooks/useRecurringTransactions';
import { useToast } from '../../contexts/ToastContext';
import type { RecurringTransaction, Category, CreateRecurringTransactionDTO, Frequency } from '../../types';
import { useFormValidation } from '../../hooks/useFormValidation';
import FieldError from '../shared/FieldError';

interface RecurringFormModalProps {
  isOpen: boolean;
  editingItem: RecurringTransaction | null;
  categories: Category[];
  onClose: () => void;
  onSuccess: () => void;
}

export default function RecurringFormModal({
  isOpen,
  editingItem,
  categories,
  onClose,
  onSuccess,
}: RecurringFormModalProps) {
  const createMutation = useCreateRecurring();
  const updateMutation = useUpdateRecurring();
  const toast = useToast();

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
    if (editingItem && isOpen) {
      setFormData({
        amount: Number(editingItem.amount),
        type: editingItem.type,
        description: editingItem.description,
        categoryId: editingItem.categoryId || '',
        frequency: editingItem.frequency,
        dayOfMonth: editingItem.dayOfMonth || 1,
        startDate: editingItem.startDate.split('T')[0],
        endDate: editingItem.endDate ? editingItem.endDate.split('T')[0] : '',
      });
    } else if (!editingItem && isOpen) {
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
    }
  }, [editingItem, isOpen]);

  const filteredCategories = categories.filter((cat) => cat.type === formData.type);
  const isPending = createMutation.isPending || updateMutation.isPending;

  const { errors, validate, clearError } = useFormValidation<CreateRecurringTransactionDTO>({
  amount: (value) => {
    if (!value || value <= 0) return 'Inserisci un importo valido maggiore di zero';
    return null;
  },
  description: (value) => {
    if (!value?.trim()) return 'La descrizione è obbligatoria';
    if (value.trim().length < 2) return 'Descrizione troppo corta';
    if (value.trim().length > 100) return 'Descrizione troppo lunga (max 100 caratteri)';
    return null;
  },
  startDate: (value) => {
    if (!value) return 'La data di inizio è obbligatoria';
    return null;
  },
  endDate: (value, form) => {
    if (value && form.startDate && value <= form.startDate) {
      return 'La data di fine deve essere successiva alla data di inizio';
    }
    return null;
  },
  dayOfMonth: (value, form) => {
    if (form.frequency === 'MONTHLY') {
      if (!value || value < 1 || value > 31) return 'Inserisci un giorno valido (1-31)';
    }
    return null;
  },
  categoryId: (value) => {
    if (!value) return 'La categoria è obbligatoria';
    return null;
  },
});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!validate(formData)) return;
    try {
      if (editingItem) {
        await updateMutation.mutateAsync({ id: editingItem.id, data: formData });
        toast.success('Spesa ricorrente aggiornata con successo');
      } else {
        await createMutation.mutateAsync(formData);
        toast.success('Spesa ricorrente creata con successo');
      }
      onClose();
      onSuccess();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Errore nel salvataggio');
    }
  };

  if (!isOpen) return null;

  return (
    <BaseModal
      isOpen={isOpen}
      title={editingItem ? 'Modifica Spesa Ricorrente' : 'Nuova Spesa Ricorrente'}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="form-group">
          <label className="form-label">Tipo</label>
          <div className="form-button-group">
            <button type="button"
              onClick={() => setFormData({ ...formData, type: 'INCOME', categoryId: '' })}
              className={`btn-toggle flex-1 ${formData.type === 'INCOME' ? 'btn-toggle-income-active' : 'btn-toggle-inactive'}`}
            >Entrata</button>
            <button type="button"
              onClick={() => setFormData({ ...formData, type: 'EXPENSE', categoryId: '' })}
              className={`btn-toggle flex-1 ${formData.type === 'EXPENSE' ? 'btn-toggle-expense-active' : 'btn-toggle-inactive'}`}
            >Uscita</button>
          </div>
        </div>

          <InputDecimal 
          setFormData={(data) => { setFormData(data); clearError('amount'); }} 
          formData={formData} 
          label="Importo (€)" />
          <FieldError message={errors.amount} />


        <div className="form-group">
          <label className="form-label">Descrizione</label>
          <input type="text" value={formData.description}
            onChange={(e) => {
              setFormData({ ...formData, description: e.target.value })
              clearError('description');
            }}
            className="form-input" />
            <FieldError message={errors.description} />
        </div>

        <div className="form-group">
          <label className="form-label">Categoria</label>
          <select value={formData.categoryId}
            onChange={(e) => {
              setFormData({ ...formData, categoryId: e.target.value })
              clearError('categoryId');
            }}
            className="form-select">
            <option value="">Senza categoria</option>
            {filteredCategories.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
            ))}
          </select>
          <FieldError message={errors.categoryId} />
        </div>

        <div className="form-group">
          <label className="form-label">Frequenza</label>
          <select value={formData.frequency}
            onChange={(e) => setFormData({ ...formData, frequency: e.target.value as Frequency })}
            className="form-select">
            <option value="WEEKLY">Settimanale</option>
            <option value="MONTHLY">Mensile</option>
            <option value="YEARLY">Annuale</option>
          </select>
        </div>

        {formData.frequency === 'MONTHLY' && (
          <div className="form-group">
            <label className="form-label">Giorno del mese</label>
            <input type="number" min={1} max={31} value={formData.dayOfMonth}
              onChange={(e) => {
                setFormData({ ...formData, dayOfMonth: parseInt(e.target.value) })
                clearError('dayOfMonth');
              }}
              className="form-input" />
              <FieldError message={errors.dayOfMonth} />
          </div>
        )}

        <div className="form-group">
          <label className="form-label">Data inizio</label>
          <input type="date" value={formData.startDate}
            onChange={(e) => {
              setFormData({ ...formData, startDate: e.target.value })
              clearError('startDate');
            }}
            className="form-input" 
            />
          <FieldError message={errors.startDate} />
        </div>

        <div className="form-group">
          <label className="form-label">Data fine (opzionale)</label>
          <input type="date" value={formData.endDate}
            onChange={(e) => {
              setFormData({ ...formData, endDate: e.target.value })
              clearError('endDate');
            }}
            className="form-input" />
            <FieldError message={errors.endDate} />
        </div>

        <div className="form-actions">
          <button type="button" onClick={onClose} className="btn btn-ghost btn-md">
            Annulla
          </button>
          <button type="submit" disabled={isPending} className="btn btn-primary btn-md">
            {isPending ? 'Salvataggio...' : editingItem ? 'Aggiorna' : 'Crea'}
          </button>
        </div>
      </form>
    </BaseModal>
  );
}