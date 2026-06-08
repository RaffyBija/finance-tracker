import { useState, useEffect } from 'react';
import BaseModal from '../layout/ModalBase';
import { InputDecimal } from '../layout/InputNumberDecimal';
import { useCreateTransaction, useUpdateTransaction } from '../../hooks/useTransactions';
import { useToast } from '../../contexts/ToastContext';
import type { Transaction, Category, CreateTransactionDTO } from '../../types';
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

const DESCRIPTION_MAX = 200;

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
  const createMutation = useCreateTransaction();
  const updateMutation = useUpdateTransaction();
  const toast = useToast();
  const { data: accounts = [] } = useAccounts();
  const { data: defaultAccount } = useDefaultAccount();
  const { currency } = useFormatCurrency();

  const [formData, setFormData] = useState<CreateTransactionDTO>({
    amount: 0,
    type: 'EXPENSE',
    description: '',
    date: new Date().toISOString().split('T')[0],
    categoryId: '',
    accountId: '',
  });
  const [submitError, setSubmitError] = useState<string | null>(null);
  const guard = useUnsavedGuard(formData, onClose);

  // Form vuoto. `carry` conserva alcuni campi tra un salvataggio e l'altro con
  // "Salva e aggiungi un'altra" (tipo e conto).
  const blankTransaction = (
    carry: Partial<CreateTransactionDTO> = {},
  ): CreateTransactionDTO => ({
    amount: 0,
    type: 'EXPENSE',
    description: '',
    date: new Date().toISOString().split('T')[0],
    categoryId: '',
    accountId: defaultAccount?.id ?? '',
    ...carry,
  });

  // Sincronizza il form all'apertura (nuovo vs modifica). Gli hook girano sempre:
  // l'early-return per !isOpen sta DOPO gli hook, mai prima (Rules of Hooks).
  useEffect(() => {
    if (!isOpen) return;
    const init: CreateTransactionDTO = editingTransactionData ? {
      amount: editingTransactionData.amount,
      type: editingTransactionData.type,
      description: editingTransactionData.description ?? '',
      date: editingTransactionData.date.split('T')[0],
      categoryId: editingTransactionData.categoryId ?? '',
      accountId: editingTransactionData.accountId ?? defaultAccount?.id ?? '',
    } : blankTransaction();
    setFormData(init);
    guard.capture(init);
    setSubmitError(null);
  }, [isOpen, editingTransactionData, defaultAccount]);

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


  // Valida e salva. Ritorna true se ok, così i chiamanti decidono se chiudere
  // (Crea) o ripartire con un form vuoto (Salva e aggiungi). In modifica, se nulla
  // è cambiato lo segnala e ritorna true senza chiamare l'API.
  const persist = async (): Promise<boolean> => {
    setSubmitError(null);
    if (!validate(formData)) return false;
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
          return true;
        }
        await updateMutation.mutateAsync({ id: editingTransactionData.id, data: formData });
        toast.success('Transazione aggiornata con successo');
      } else {
        await createMutation.mutateAsync(formData);
        toast.success('Transazione creata con successo');
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
      sentFeed();
    }
  };

  // Salva e prepara un nuovo inserimento senza chiudere: conserva tipo e conto,
  // ricattura lo snapshot pulito e rimette il focus sull'importo da desktop.
  const handleSaveAndAddAnother = async () => {
    if (!(await persist())) return;
    sentFeed();
    const next = blankTransaction({ type: formData.type, accountId: formData.accountId });
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
      title={editingTransactionData ? 'Modifica Transazione' : 'Nuova Transazione'}
      onClose={guard.requestClose}
    >
      <form className="modal-form" onSubmit={handleSubmit}>
        <FormError message={submitError} />
        <div className="form-group">
          <label className="form-label">Tipo</label>
          <div className="form-button-group">
            <button
              type="button"
              onClick={() => setFormData({ ...formData, type: 'INCOME', categoryId: '' })}
              className={`btn-toggle ${
                formData.type === 'INCOME' ? 'btn-toggle-income-active' : 'btn-toggle-inactive'
              }`}
            >
              Entrata
            </button>
            <button
              type="button"
              onClick={() => setFormData({ ...formData, type: 'EXPENSE', categoryId: '' })}
              className={`btn-toggle ${
                formData.type === 'EXPENSE' ? 'btn-toggle-expense-active' : 'btn-toggle-inactive'
              }`}
            >
              Uscita
            </button>
          </div>
        </div>
        
        <div className="modal-form-row">
          <div>
            <InputDecimal
              setFormData={(data) => { setFormData(data); clearError('amount'); }}
              formData={formData}
              label={`Importo (${currencySymbol(currency)})`}
              required
              invalid={!!errors.amount}
              describedBy={errors.amount ? 'tx-amount-err' : undefined}
            />
            <FieldError id="tx-amount-err" message={errors.amount} />
          </div>
          <div className="form-group">
            <label className="form-label form-label-required">Data</label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => {
                setFormData({ ...formData, date: e.target.value })
                clearError('date');
              }}
              aria-invalid={!!errors.date || undefined}
              aria-describedby={errors.date ? 'tx-date-err' : undefined}
              className="form-input"
              required
            />
            <FieldError id="tx-date-err" message={errors.date} />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Descrizione</label>
          <input
            type="text"
            value={formData.description}
            maxLength={DESCRIPTION_MAX}
            onChange={(e) => {
              setFormData({ ...formData, description: e.target.value })
              clearError('description');
            }}
            aria-invalid={!!errors.description || undefined}
            aria-describedby={errors.description ? 'tx-desc-err' : undefined}
            className="form-input"
            placeholder="Es. Spesa supermercato"
          />
          <FieldError id="tx-desc-err" message={errors.description} />
          <CharCount value={formData.description ?? ''} max={DESCRIPTION_MAX} />
        </div>

        <div className="form-group">
          <label className="form-label form-label-required">Categoria</label>
          <select
            value={formData.categoryId}
            onChange={(e) => {
              setFormData({ ...formData, categoryId: e.target.value })
              clearError('categoryId');
            }}
            aria-invalid={!!errors.categoryId || undefined}
            aria-describedby={errors.categoryId ? 'tx-cat-err' : undefined}
            className="form-select"
          >
            <option value="">Seleziona una categoria</option>
            {filteredCategories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.icon} {cat.name}
              </option>
            ))}
          </select>
          <FieldError id="tx-cat-err" message={errors.categoryId} />
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
          {!editingTransactionData && (
            <button type="button" onClick={handleSaveAndAddAnother} disabled={isPending} className="btn btn-secondary btn-md">
              Salva e aggiungi un'altra
            </button>
          )}
          <button type="submit" disabled={isPending} className="btn btn-primary btn-md">
            {isPending ? 'Salvataggio...' : editingTransactionData ? 'Aggiorna' : 'Crea'}
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