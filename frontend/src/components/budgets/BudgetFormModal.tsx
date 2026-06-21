import { useState, useEffect } from 'react';
import BaseModal from '../layout/ModalBase';
import type { Budget, Category, CreateBudgetDTO, BudgetPeriod } from '../../types';
import { useCreateBudget, useUpdateBudget } from '../../hooks/useBudgets';
import { useToast } from '../../contexts/ToastContext';
import { InputDecimal } from '../layout/InputNumberDecimal';
import { useFormValidation } from '../../hooks/useFormValidation';
import FieldError from '../shared/FieldError';
import FormError from '../shared/FormError';

interface BudgetFormModalProps {
  isOpen: boolean;
  editingItem: Budget | null;
  categories: Category[];
  onClose: () => void;
  onSuccess: () => void;
}

export default function BudgetFormModal({
  isOpen,
  editingItem,
  categories,
  onClose,
  onSuccess,
}: BudgetFormModalProps) {
  const createMutation = useCreateBudget();
  const updateMutation = useUpdateBudget();
  const toast = useToast();

  const [formData, setFormData] = useState<CreateBudgetDTO>({
    name: '',
    amount: 0,
    categoryId: '',
    period: 'MONTHLY',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
  });
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    setSubmitError(null);
    if (editingItem && isOpen) {
      setFormData({
        name: editingItem.name,
        amount: Number(editingItem.amount),
        categoryId: editingItem.categoryId || '',
        period: editingItem.period,
        startDate: editingItem.startDate.split('T')[0],
        endDate: editingItem.endDate ? editingItem.endDate.split('T')[0] : '',
      });
    } else if (!editingItem && isOpen) {
      setFormData({
        name: '',
        amount: 0,
        categoryId: '',
        period: 'MONTHLY',
        startDate: new Date().toISOString().split('T')[0],
        endDate: '',
      });
    }
  }, [editingItem, isOpen]);

  const isPending = createMutation.isPending || updateMutation.isPending;

  const { errors, validate, clearError } = useFormValidation<CreateBudgetDTO>({
  name: (value) => {
    if (!value?.trim()) return 'Il nome è obbligatorio';
    if (value.trim().length < 2) return 'Il nome deve avere almeno 2 caratteri';
    if (value.trim().length > 50) return 'Il nome è troppo lungo (max 50 caratteri)';
    return null;
  },
  amount: (value) => {
    if (!value || value <= 0) return 'Inserisci un importo valido maggiore di zero';
    if (value > 999999) return 'Importo troppo elevato';
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
  // La categoria è OPZIONALE: un budget senza categoria è un budget complessivo
  // (Prisma categoryId String?, backend gestisce `if (categoryId)`). La label dice
  // "(opzionale)" — niente validazione required qui.
});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    if (!validate(formData)) return;
    try {
      if (editingItem) {
        await updateMutation.mutateAsync({ id: editingItem.id, data: formData });
        toast.success('Budget aggiornato con successo');
      } else {
        await createMutation.mutateAsync(formData);
        toast.success('Budget creato con successo');
      }
      onClose();
      onSuccess();
    } catch (error: any) {
      setSubmitError(error.response?.data?.error || 'Errore nel salvataggio. Riprova.');
    }
  };

  if (!isOpen) return null;

  return (
    <BaseModal
      isOpen={isOpen}
      title={editingItem ? 'Modifica Budget' : 'Nuovo Budget'}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="modal-form">
        <FormError message={submitError} />
        <div className="form-group">
          <label className="form-label form-label-required">Nome</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => {
              setFormData({ ...formData, name: e.target.value })
              clearError('name');
            }}
            className="form-input"
          />
          <FieldError message={errors.name} />
        </div>

        <div className="modal-form-row">
          <div>
            <InputDecimal
              setFormData={(data) => { setFormData(data); clearError('amount'); }}
              formData={formData}
              label="Importo Budget (€)"
              required
            />
            <FieldError message={errors.amount} />
          </div>
          <div className="form-group">
            <label className="form-label">Categoria (opzionale)</label>
            <select
              value={formData.categoryId}
              onChange={(e) => {
                setFormData({ ...formData, categoryId: e.target.value })
                clearError('categoryId');
              }}
              className="form-select"
            >
              <option value="">--Seleziona--</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
            <FieldError message={errors.categoryId} />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label form-label-required">Periodo</label>
          <select
            value={formData.period}
            onChange={(e) => setFormData({ ...formData, period: e.target.value as BudgetPeriod })}
            className="form-select"
          >
            <option value="WEEKLY">Settimanale</option>
            <option value="MONTHLY">Mensile</option>
            <option value="YEARLY">Annuale</option>
          </select>
          <p className="form-help">
            Il budget si azzera automaticamente a ogni periodo. Lo storico di ogni
            periodo resta consultabile dal dettaglio.
          </p>
        </div>

        <div className="modal-form-row">
          <div className="form-group">
            <label className="form-label form-label-required">Attivo da</label>
            <input
              type="date"
              value={formData.startDate}
              onChange={(e) => {
                setFormData({ ...formData, startDate: e.target.value })
                clearError('startDate');
              }}
              className="form-input"
            />
            <FieldError message={errors.startDate} />
          </div>
          <div className="form-group">
            <label className="form-label">Attivo fino a (opzionale)</label>
            <input
              type="date"
              value={formData.endDate}
              onChange={(e) => {
                setFormData({ ...formData, endDate: e.target.value })
                clearError('endDate');
              }}
              className="form-input"
            />
            <FieldError message={errors.endDate} />
          </div>
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