import { useState } from 'react';
import BaseModal from '../layout/ModalBase';
import { InputDecimal } from '../layout/InputNumberDecimal';
import { useCreateTransaction, useUpdateTransaction } from '../../hooks/useTransactions';
import { useToast } from '../../contexts/ToastContext';
import type { Transaction, Category, CreateTransactionDTO } from '../../types';
import { useFormValidation } from '../../hooks/useFormValidation';
import FieldError from '../shared/FieldError';

interface TransactionModalProps {
  isOpen: boolean;
  categories: Category[];
  editingTransactionData: Transaction | null;
  onClose: () => void;
  sentFeed: () => void;
}

export default function TransactionModal({
  isOpen,
  categories,
  editingTransactionData,
  onClose,
  sentFeed,
}: TransactionModalProps) {
  if (!isOpen) return null;

  const createMutation = useCreateTransaction();
  const updateMutation = useUpdateTransaction();
  const toast = useToast();

  const [formData, setFormData] = useState<CreateTransactionDTO>({
    amount: editingTransactionData?.amount ?? 0,
    type: editingTransactionData?.type ?? 'EXPENSE',
    description: editingTransactionData?.description ?? '',
    date: editingTransactionData?.date.split('T')[0] ?? new Date().toISOString().split('T')[0],
    categoryId: editingTransactionData?.categoryId ?? '',
  });

  const filteredCategories = categories.filter((cat) => cat.type === formData.type);
  const isPending = createMutation.isPending || updateMutation.isPending;

const { errors, validate, clearError } = useFormValidation<CreateTransactionDTO>({
  amount: (value) => {
    if (!value || value <= 0) return 'Inserisci un importo valido maggiore di zero';
    if (value > 999999) return 'Importo troppo elevato';
    return null;
  },
  description: (value) => {
    if (value && value.length > 200) return 'Descrizione troppo lunga (max 200 caratteri)';
    return null;
  },
  date: (value) => {
    if (!value) return 'La data è obbligatoria';
    return null;
  },
  categoryId: (value) => {
    if (!value) return 'La categoria è obbligatoria';
    return null;
  }
});


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate(formData)) return; 
    try {
      if (editingTransactionData) {
        const unchanged =
          editingTransactionData.amount === formData.amount &&
          editingTransactionData.type === formData.type &&
          editingTransactionData.description === formData.description &&
          editingTransactionData.date.split('T')[0] === formData.date &&
          editingTransactionData.categoryId === formData.categoryId;

        if (unchanged) {
          toast.info('Nessuna modifica apportata');
          onClose();
          return;
        }
        await updateMutation.mutateAsync({ id: editingTransactionData.id, data: formData });
        toast.success('Transazione aggiornata con successo');
      } else {
        await createMutation.mutateAsync(formData);
        toast.success('Transazione creata con successo');
      }

      onClose();
      sentFeed();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Errore nel salvataggio');
    }
  };

  return (
    <BaseModal
      isOpen={isOpen}
      title={editingTransactionData ? 'Modifica Transazione' : 'Nuova Transazione'}
      onClose={onClose}
    >
      <form className="modal-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label">Tipo</label>
          <div className="form-button-group">
            <button
              type="button"
              onClick={() => setFormData({ ...formData, type: 'INCOME', categoryId: '' })}
              className={`btn-toggle flex-1 ${
                formData.type === 'INCOME' ? 'btn-toggle-income-active' : 'btn-toggle-inactive'
              }`}
            >
              Entrata
            </button>
            <button
              type="button"
              onClick={() => setFormData({ ...formData, type: 'EXPENSE', categoryId: '' })}
              className={`btn-toggle flex-1 ${
                formData.type === 'EXPENSE' ? 'btn-toggle-expense-active' : 'btn-toggle-inactive'
              }`}
            >
              Uscita
            </button>
          </div>
        </div>
        
          <InputDecimal
            setFormData={(data) => { setFormData(data); clearError('amount'); }}
            formData={formData}
            label="Importo (€)"
          />
          <FieldError message={errors.amount} />

        <div className="form-group">
          <label className="form-label">Descrizione</label>
          <input
            type="text"
            value={formData.description}
            onChange={(e) => {
              setFormData({ ...formData, description: e.target.value })
              clearError('description');
            }}
            className="form-input"
            placeholder="Es. Spesa supermercato"
          />
          <FieldError message={errors.description} />
        </div>

        <div className="form-group">
          <label className="form-label">Data</label>
          <input
            type="date"
            value={formData.date}
            onChange={(e) => {
              setFormData({ ...formData, date: e.target.value })
              clearError('date');
            }}
            className="form-input"
            required
          />
          <FieldError message={errors.date} />
        </div>

        <div className="form-group">
          <label className="form-label">Categoria</label>
          <select
            value={formData.categoryId}
            onChange={(e) => {
              setFormData({ ...formData, categoryId: e.target.value })
              clearError('categoryId');
            }}
            className="form-select"
          >
            <option value="">--Seleziona una categoria--</option>
            {filteredCategories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.icon} {cat.name}
              </option>
            ))}
          </select>
          <FieldError message={errors.categoryId} />
        </div>

        <div className="form-actions">
          <button type="button" onClick={onClose} className="btn btn-ghost btn-md">
            Annulla
          </button>
          <button type="submit" disabled={isPending} className="btn btn-primary btn-md">
            {isPending ? 'Salvataggio...' : editingTransactionData ? 'Aggiorna' : 'Crea'}
          </button>
        </div>
      </form>
    </BaseModal>
  );
}