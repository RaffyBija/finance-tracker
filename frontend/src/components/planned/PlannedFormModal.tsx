import { useState, useEffect } from 'react';
import BaseModal from '../layout/ModalBase';
import { InputDecimal } from '../layout/InputNumberDecimal';
import { useCreatePlanned, useUpdatePlanned } from '../../hooks/usePlannedTransactions';
import { useToast } from '../../contexts/ToastContext';
import type { PlannedTransaction, Category, CreatePlannedTransactionDTO } from '../../types';
import { useFormValidation } from '../../hooks/useFormValidation';
import FieldError from '../shared/FieldError';
import FormError from '../shared/FormError';
import AccountSelector from '../accounts/AccountSelector';
import { useAccounts, useDefaultAccount } from '../../hooks/useAccounts';
import { useFormatCurrency } from '../../hooks/useFormatCurrency';
import { currencySymbol } from '../../utils/currency';
import CharCount from '../shared/CharCount';
import ConfirmModal from '../shared/ConfirmModal';
import { useUnsavedGuard } from '../../hooks/useUnsavedGuard';

const DESCRIPTION_MAX = 100;
const NOTES_MAX = 300;

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
  const updateMutation = useUpdatePlanned();
  const toast = useToast();
  const { data: accounts = [] } = useAccounts();
  const { data: defaultAccount } = useDefaultAccount();
  const { currency } = useFormatCurrency();

  const [formData, setFormData] = useState<CreatePlannedTransactionDTO>({
    amount: 0,
    type: 'EXPENSE',
    description: '',
    categoryId: '',
    plannedDate: new Date().toISOString().split('T')[0],
    notes: '',
    accountId: defaultAccount?.id ?? '',
  });
  const [submitError, setSubmitError] = useState<string | null>(null);
  const guard = useUnsavedGuard(formData, onClose);

  // Form vuoto. `carry` consente di conservare alcuni campi tra un salvataggio e
  // l'altro con "Salva e aggiungi un'altra" (tipo e conto).
  const blankPlanned = (
    carry: Partial<CreatePlannedTransactionDTO> = {},
  ): CreatePlannedTransactionDTO => ({
    amount: 0,
    type: 'EXPENSE',
    description: '',
    categoryId: '',
    plannedDate: new Date().toISOString().split('T')[0],
    notes: '',
    accountId: defaultAccount?.id ?? '',
    ...carry,
  });

  useEffect(() => {
    setSubmitError(null);
    if (!isOpen) return;
    const init: CreatePlannedTransactionDTO = editingItem ? {
      amount: Number(editingItem.amount),
      type: editingItem.type,
      description: editingItem.description,
      categoryId: editingItem.categoryId || '',
      plannedDate: editingItem.plannedDate.split('T')[0],
      notes: editingItem.notes || '',
      accountId: editingItem.accountId ?? defaultAccount?.id ?? '',
    } : blankPlanned();
    setFormData(init);
    guard.capture(init);
  }, [editingItem, isOpen]);

  const filteredCategories = categories.filter((cat) => cat.type === formData.type);
  const isPending = createMutation.isPending || updateMutation.isPending;

  const { errors, validate, clearError } = useFormValidation<CreatePlannedTransactionDTO>({
  amount: (value) => {
    if (!value || value <= 0) return 'Inserisci un importo valido maggiore di zero';
    return null;
  },
  description: (value) => {
    if (!value?.trim()) return 'La descrizione è obbligatoria';
    if (value.trim().length < 2) return 'Descrizione troppo corta';
    if (value.trim().length > DESCRIPTION_MAX) return `Descrizione troppo lunga (max ${DESCRIPTION_MAX} caratteri)`;
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

  // Valida e salva. Ritorna true se andato a buon fine, così i chiamanti
  // decidono se chiudere (Crea) o ripartire con un form vuoto (Salva e aggiungi).
  const persist = async (): Promise<boolean> => {
    setSubmitError(null);
    if (!validate(formData)) return false;
    try {
      if (editingItem) {
        await updateMutation.mutateAsync({ id: editingItem.id, data: formData });
        toast.success('Spesa pianificata aggiornata con successo');
      } else {
        await createMutation.mutateAsync(formData);
        toast.success('Spesa pianificata creata con successo');
      }
      return true;
    } catch (error: any) {
      setSubmitError(error.response?.data?.error || 'Errore nel salvataggio. Riprova.');
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (await persist()) {
      onClose();
      onSuccess();
    }
  };

  // Salva e prepara un nuovo inserimento senza chiudere: conserva tipo e conto,
  // ricattura lo snapshot pulito (la guardia non deve scattare) e rimette il
  // focus sull'importo da desktop.
  const handleSaveAndAddAnother = async () => {
    if (!(await persist())) return;
    onSuccess();
    const next = blankPlanned({ type: formData.type, accountId: formData.accountId });
    setFormData(next);
    guard.capture(next);
    if (window.matchMedia('(pointer: fine)').matches) {
      requestAnimationFrame(() =>
        document.querySelector<HTMLElement>('.modal-content input')?.focus(),
      );
    }
  };

  if (!isOpen) return null;

  return (
    <>
    <BaseModal
      isOpen={isOpen}
      title={editingItem ? 'Modifica Spesa Pianificata' : 'Nuova Spesa Pianificata'}
      onClose={guard.requestClose}
    >
      <form onSubmit={handleSubmit} className="modal-form">
        <FormError message={submitError} />
        <div className="form-group">
          <label className="form-label">Tipo</label>
          <div className="form-button-group">
            <button type="button"
              onClick={() => setFormData({ ...formData, type: 'INCOME', categoryId: '' })}
              className={`btn-toggle ${formData.type === 'INCOME' ? 'btn-toggle-income-active' : 'btn-toggle-inactive'}`}
            >Entrata</button>
            <button type="button"
              onClick={() => setFormData({ ...formData, type: 'EXPENSE', categoryId: '' })}
              className={`btn-toggle ${formData.type === 'EXPENSE' ? 'btn-toggle-expense-active' : 'btn-toggle-inactive'}`}
            >Uscita</button>
          </div>
        </div>

        <div className="modal-form-row">
          <div>
            <InputDecimal
              setFormData={(value) => { setFormData(value); clearError('amount'); }}
              formData={formData}
              label={`Importo (${currencySymbol(currency)})`}
              required
              invalid={!!errors.amount}
              describedBy={errors.amount ? 'pl-amount-err' : undefined}
            />
            <FieldError id="pl-amount-err" message={errors.amount} />
          </div>
          <div className="form-group">
            <label className="form-label form-label-required">Data pianificata</label>
            <input type="date" value={formData.plannedDate}
              onChange={(e) => {
                setFormData({ ...formData, plannedDate: e.target.value })
                clearError('plannedDate');
              }}
              aria-invalid={!!errors.plannedDate || undefined}
              aria-describedby={errors.plannedDate ? 'pl-date-err' : undefined}
              className="form-input" />
            <FieldError id="pl-date-err" message={errors.plannedDate} />
            <p className="form-help">Diventerà una transazione reale in questa data.</p>
          </div>
        </div>

        <div className="modal-form-row">
          <div className="form-group">
            <label className="form-label form-label-required">Descrizione</label>
            <input type="text" value={formData.description}
              maxLength={DESCRIPTION_MAX}
              onChange={(e) => {
                setFormData({ ...formData, description: e.target.value });
                clearError('description');
              }}
              aria-invalid={!!errors.description || undefined}
              aria-describedby={errors.description ? 'pl-desc-err' : undefined}
              className="form-input" />
            <FieldError id="pl-desc-err" message={errors.description} />
            <CharCount value={formData.description} max={DESCRIPTION_MAX} />
          </div>

          <div className="form-group">
            <label className="form-label form-label-required">Categoria</label>
            <select value={formData.categoryId}
              onChange={(e) => {
                setFormData({ ...formData, categoryId: e.target.value })
                clearError('categoryId');
              }}
              aria-invalid={!!errors.categoryId || undefined}
              aria-describedby={errors.categoryId ? 'pl-cat-err' : undefined}
              className="form-select">
              <option value="">Seleziona una categoria</option>
              {filteredCategories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
              ))}
            </select>
            <FieldError id="pl-cat-err" message={errors.categoryId} />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Note (opzionale)</label>
          <textarea value={formData.notes}
            maxLength={NOTES_MAX}
            onChange={(e) => {
              setFormData({ ...formData, notes: e.target.value })
              clearError('notes');
            }}
            aria-invalid={!!errors.notes || undefined}
            aria-describedby={errors.notes ? 'pl-notes-err' : undefined}
            className="form-input" rows={2}
            placeholder="Eventuali note..." />
          <FieldError id="pl-notes-err" message={errors.notes} />
          <CharCount value={formData.notes ?? ''} max={NOTES_MAX} />
        </div>

        {accounts.length > 1 && (
          <AccountSelector
            accounts={accounts}
            value={formData.accountId ?? ''}
            onChange={(id) => setFormData({ ...formData, accountId: id })}
            label="Conto"
          />
        )}

        <div className="form-actions">
          <button type="button" onClick={guard.requestClose} className="btn btn-ghost btn-md">
            Annulla
          </button>
          {!editingItem && (
            <button type="button" onClick={handleSaveAndAddAnother} disabled={isPending} className="btn btn-secondary btn-md">
              Salva e aggiungi un'altra
            </button>
          )}
          <button type="submit" disabled={isPending} className="btn btn-primary btn-md">
            {isPending ? 'Salvataggio...' : editingItem ? 'Aggiorna' : 'Crea'}
          </button>
        </div>
      </form>
    </BaseModal>

    <ConfirmModal
      isOpen={guard.confirming}
      title="Scartare le modifiche?"
      message="Hai modifiche non salvate. Se chiudi ora andranno perse."
      confirmLabel="Scarta"
      onConfirm={guard.confirmDiscard}
      onClose={guard.dismissConfirm}
    />
    </>
  );
}