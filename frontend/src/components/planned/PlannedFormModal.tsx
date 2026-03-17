import { useState, useEffect } from 'react';
import BaseModal from '../layout/ModalBase';
import { InputDecimal } from '../layout/InputNumberDecimal';
import { useCreatePlanned } from '../../hooks/usePlannedTransactions';
import { useToast } from '../../contexts/ToastContext';
import { useQueryClient } from '@tanstack/react-query';
import { plannedApi } from '../../api/planned';
import type { PlannedTransaction, Category, CreatePlannedTransactionDTO } from '../../types';
import { useFormValidation } from '../../hooks/useFormValidation';
import FieldError from '../shared/FieldError';

interface PlannedFormModalProps {
  isOpen: boolean;
  editingItem: PlannedTransaction | null;
  categories: Category[];
  onClose: () => void;
  onSuccess: () => void;
}

export default function PlannedFormModal({
  isOpen,
  editingItem,
  categories,
  onClose,
  onSuccess,
}: PlannedFormModalProps) {
  const createMutation = useCreatePlanned();
  const queryClient = useQueryClient();
  const toast = useToast();

  const [formData, setFormData] = useState<CreatePlannedTransactionDTO>({
    amount: 0,
    type: 'EXPENSE',
    description: '',
    categoryId: '',
    plannedDate: new Date().toISOString().split('T')[0],
    notes: '',
  });

  useEffect(() => {
    if (editingItem && isOpen) {
      setFormData({
        amount: Number(editingItem.amount),
        type: editingItem.type,
        description: editingItem.description,
        categoryId: editingItem.categoryId || '',
        plannedDate: editingItem.plannedDate.split('T')[0],
        notes: editingItem.notes || '',
      });
    } else if (!editingItem && isOpen) {
      setFormData({
        amount: 0,
        type: 'EXPENSE',
        description: '',
        categoryId: '',
        plannedDate: new Date().toISOString().split('T')[0],
        notes: '',
      });
    }
  }, [editingItem, isOpen]);

  const filteredCategories = categories.filter((cat) => cat.type === formData.type);
  const isPending = createMutation.isPending;

  const { errors, validate, clearError } = useFormValidation<CreatePlannedTransactionDTO>({
  amount: (value) => {
    if (!value || value <= 0) return 'Inserisci un importo valido maggiore di zero';
    return null;
  },
  description: (value) => {
    if (!value?.trim()) return 'La descrizione è obbligatoria';
    if (value.trim().length < 2) return 'Descrizione troppo corta';
    return null;
  },
  plannedDate: (value) => {
    if (!value) return 'La data pianificata è obbligatoria';
    return null;
  },
  notes: (value) => {
    if (value && value.length > 300) return 'Note troppo lunghe (max 300 caratteri)';
    return null;
  },
  categoryId: (value) => {
    if (!value) return 'La categoria è obbligatoria';
    return null;
  }
});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!validate(formData)) return;
    try {
      if (editingItem) {
        await plannedApi.update(editingItem.id, formData);
        queryClient.invalidateQueries({ queryKey: ['planned'] });
        toast.success('Spesa pianificata aggiornata con successo');
      } else {
        await createMutation.mutateAsync(formData);
        toast.success('Spesa pianificata creata con successo');
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
      title={editingItem ? 'Modifica Spesa Pianificata' : 'Nuova Spesa Pianificata'}
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
          setFormData={(value)=>{
            setFormData(value);
            clearError('amount');
          }} 
          formData={formData} 
          label="Importo (€)" 
          />
        <FieldError message={errors.amount} />

        <div className="form-group">
          <label className="form-label">Descrizione</label>
          <input type="text" value={formData.description}
            onChange={(e) => {
              setFormData({ ...formData, description: e.target.value });
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
            <option value="">--Seleziona una categoria--</option>
            {filteredCategories.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
            ))}
          </select>
          <FieldError message={errors.categoryId} />
        </div>

        <div className="form-group">
          <label className="form-label">Data pianificata</label>
          <input type="date" value={formData.plannedDate}
            onChange={(e) => {
              setFormData({ ...formData, plannedDate: e.target.value })
              clearError('plannedDate');
              }}
            className="form-input" />
            <FieldError message={errors.plannedDate} />
        </div>

        <div className="form-group">
          <label className="form-label">Note (opzionale)</label>
          <textarea value={formData.notes}
            onChange={(e) => {
              setFormData({ ...formData, notes: e.target.value })
              clearError('notes');
            }}
            className="form-input resize-none" rows={2}
            placeholder="Eventuali note..." />
            <FieldError message={errors.notes} />
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