import { useState, useEffect } from 'react';
import BaseModal from '../layout/ModalBase';
import { InputDecimal } from '../layout/InputNumberDecimal';
import { useCreateRecurring, useUpdateRecurring } from '../../hooks/useRecurringTransactions';
import { useToast } from '../../contexts/ToastContext';
import type { RecurringTransaction, Category, CreateRecurringTransactionDTO, Frequency } from '../../types';
import { useFormValidation } from '../../hooks/useFormValidation';
import FieldError from '../shared/FieldError';
import FormError from '../shared/FormError';
import AccountSelector from '../accounts/AccountSelector';
import { useAccounts, useDefaultAccount } from '../../hooks/useAccounts';
import { formatWeekday, formatDayMonthLong, isoWeekdayIndex, setIsoWeekday } from '../../utils/date';
import { Repeat } from 'lucide-react';
import { useFormatCurrency } from '../../hooks/useFormatCurrency';
import { currencySymbol } from '../../utils/currency';
import CharCount from '../shared/CharCount';
import ConfirmModal from '../shared/ConfirmModal';
import { useUnsavedGuard } from '../../hooks/useUnsavedGuard';

const DESCRIPTION_MAX = 100;

// Giorni della settimana in ordine ISO (0 = lunedì). Etichetta breve sulla chip,
// nome completo per screen reader e tooltip.
const WEEKDAYS = [
  { short: 'Lun', long: 'Lunedì' },
  { short: 'Mar', long: 'Martedì' },
  { short: 'Mer', long: 'Mercoledì' },
  { short: 'Gio', long: 'Giovedì' },
  { short: 'Ven', long: 'Venerdì' },
  { short: 'Sab', long: 'Sabato' },
  { short: 'Dom', long: 'Domenica' },
] as const;

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
  const { data: accounts = [] } = useAccounts();
  const { data: defaultAccount } = useDefaultAccount();
  const { currency } = useFormatCurrency();

  const [formData, setFormData] = useState<CreateRecurringTransactionDTO>({
    amount: 0,
    type: 'EXPENSE',
    description: '',
    categoryId: '',
    frequency: 'MONTHLY',
    dayOfMonth: 1,
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    accountId: defaultAccount?.id ?? '',
  });
  const [submitError, setSubmitError] = useState<string | null>(null);
  const guard = useUnsavedGuard(formData, onClose);

  // Form vuoto. `carry` conserva alcuni campi tra un salvataggio e l'altro con
  // "Salva e aggiungi un'altra" (tipo, conto, frequenza).
  const blankRecurring = (
    carry: Partial<CreateRecurringTransactionDTO> = {},
  ): CreateRecurringTransactionDTO => ({
    amount: 0,
    type: 'EXPENSE',
    description: '',
    categoryId: '',
    frequency: 'MONTHLY',
    dayOfMonth: 1,
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    accountId: defaultAccount?.id ?? '',
    ...carry,
  });

  useEffect(() => {
    setSubmitError(null);
    if (!isOpen) return;
    const init: CreateRecurringTransactionDTO = editingItem ? {
      amount: Number(editingItem.amount),
      type: editingItem.type,
      description: editingItem.description,
      categoryId: editingItem.categoryId || '',
      frequency: editingItem.frequency,
      dayOfMonth: editingItem.dayOfMonth || 1,
      startDate: editingItem.startDate.split('T')[0],
      endDate: editingItem.endDate ? editingItem.endDate.split('T')[0] : '',
      accountId: editingItem.accountId ?? defaultAccount?.id ?? '',
    } : blankRecurring();
    setFormData(init);
    guard.capture(init);
  }, [editingItem, isOpen]);

  const filteredCategories = categories.filter((cat) => cat.type === formData.type);
  const isPending = createMutation.isPending || updateMutation.isPending;

  // Riepilogo in linguaggio naturale di quando la ricorrente verrà eseguita.
  // Rende visibile la regola altrimenti implicita (il giorno della settimana e
  // l'anniversario derivano dalla data di inizio) e chiarisce che l'aggiunta è
  // automatica. Si aggiorna mentre l'utente modifica frequenza/giorno/data.
  const scheduleHint = (() => {
    if (formData.frequency === 'WEEKLY') {
      return formData.startDate
        ? `Aggiunta in automatico ogni ${formatWeekday(formData.startDate)}, dalla data di inizio.`
        : 'Aggiunta in automatico ogni settimana, nel giorno della data di inizio.';
    }
    if (formData.frequency === 'YEARLY') {
      return formData.startDate
        ? `Aggiunta in automatico ogni anno, il ${formatDayMonthLong(formData.startDate)}.`
        : 'Aggiunta in automatico ogni anno, alla data di inizio.';
    }
    const day = formData.dayOfMonth || 1;
    const base = `Aggiunta in automatico ogni mese, il giorno ${day}.`;
    return day > 28 ? `${base} Nei mesi più corti viene usato l'ultimo giorno.` : base;
  })();

  // Selettore conto (solo con più di un conto). Estratto perché il suo layout
  // dipende dalla frequenza: con MONTHLY divide la riga col "giorno del mese";
  // con WEEKLY/YEARLY (niente giorno) va a tutta larghezza, così non resta una
  // mezza cella vuota accanto né il nome del conto viene troncato.
  const accountSelector = accounts.length > 1 ? (
    <AccountSelector
      accounts={accounts}
      value={formData.accountId ?? ''}
      onChange={(id) => setFormData({ ...formData, accountId: id })}
      label="Conto"
    />
  ) : null;

  // Il giorno della settimana vive dentro startDate: selezionarne uno sposta la
  // data inizio a quel giorno, restando nella stessa settimana lun-dom.
  const selectedWeekday = isoWeekdayIndex(formData.startDate);
  const selectWeekday = (i: number) => {
    setFormData({ ...formData, startDate: setIsoWeekday(formData.startDate, i) });
    clearError('startDate');
  };
  // Tastiera radiogroup: frecce per spostare la selezione (e quindi la data).
  const onWeekdayKey = (e: React.KeyboardEvent, i: number) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const next = (i + (e.key === 'ArrowRight' ? 1 : -1) + 7) % 7;
    selectWeekday(next);
    requestAnimationFrame(() =>
      document.querySelectorAll<HTMLElement>('.weekday-picker .weekday-chip')[next]?.focus(),
    );
  };

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

  // Valida e salva. Ritorna true se ok, così i chiamanti decidono se chiudere
  // (Crea) o ripartire con un form vuoto (Salva e aggiungi).
  const persist = async (): Promise<boolean> => {
    setSubmitError(null);
    if (!validate(formData)) return false;
    try {
      if (editingItem) {
        await updateMutation.mutateAsync({ id: editingItem.id, data: formData });
        toast.success('Spesa ricorrente aggiornata con successo');
      } else {
        await createMutation.mutateAsync(formData);
        toast.success('Spesa ricorrente creata con successo');
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

  // Salva e prepara un nuovo inserimento senza chiudere: conserva tipo, conto e
  // frequenza, ricattura lo snapshot pulito e rimette il focus sull'importo.
  const handleSaveAndAddAnother = async () => {
    if (!(await persist())) return;
    onSuccess();
    const next = blankRecurring({
      type: formData.type,
      accountId: formData.accountId,
      frequency: formData.frequency,
    });
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
      title={editingItem ? 'Modifica Spesa Ricorrente' : 'Nuova Spesa Ricorrente'}
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
              setFormData={(data) => { setFormData(data); clearError('amount'); }}
              formData={formData}
              label={`Importo (${currencySymbol(currency)})`}
              required
              invalid={!!errors.amount}
              describedBy={errors.amount ? 'rec-amount-err' : undefined}
            />
            <FieldError id="rec-amount-err" message={errors.amount} />
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
        </div>

        <div className="modal-form-row">
          <div className="form-group">
            <label className="form-label form-label-required">Descrizione</label>
            <input type="text" value={formData.description}
              maxLength={DESCRIPTION_MAX}
              onChange={(e) => {
                setFormData({ ...formData, description: e.target.value })
                clearError('description');
              }}
              aria-invalid={!!errors.description || undefined}
              aria-describedby={errors.description ? 'rec-desc-err' : undefined}
              className="form-input" />
            <FieldError id="rec-desc-err" message={errors.description} />
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
              aria-describedby={errors.categoryId ? 'rec-cat-err' : undefined}
              className="form-select">
              <option value="">Seleziona una categoria</option>
              {filteredCategories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
              ))}
            </select>
            <FieldError id="rec-cat-err" message={errors.categoryId} />
          </div>
        </div>

        {formData.frequency === 'MONTHLY' && (
          <div className="modal-form-row">
            <div className="form-group">
              <label className="form-label form-label-required">Giorno del mese</label>
              <input type="number" min={1} max={31} value={formData.dayOfMonth ?? ''}
                onChange={(e) => {
                  const n = parseInt(e.target.value, 10);
                  setFormData({ ...formData, dayOfMonth: Number.isNaN(n) ? undefined : n })
                  clearError('dayOfMonth');
                }}
                aria-invalid={!!errors.dayOfMonth || undefined}
                aria-describedby={errors.dayOfMonth ? 'rec-day-err' : undefined}
                className="form-input" />
              <FieldError id="rec-day-err" message={errors.dayOfMonth} />
            </div>
            {accountSelector}
          </div>
        )}

        {formData.frequency === 'WEEKLY' && (
          <>
            <div className="form-group">
              <label className="form-label form-label-required" id="rec-weekday-label">
                Giorno della settimana
              </label>
              <div
                className="weekday-picker"
                role="radiogroup"
                aria-labelledby="rec-weekday-label"
              >
                {WEEKDAYS.map((wd, i) => {
                  const selected = selectedWeekday === i;
                  return (
                    <button
                      key={wd.short}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      tabIndex={selected ? 0 : -1}
                      aria-label={wd.long}
                      title={wd.long}
                      onClick={() => selectWeekday(i)}
                      onKeyDown={(e) => onWeekdayKey(e, i)}
                      className={`weekday-chip${selected ? ' is-selected' : ''}`}
                    >
                      {wd.short}
                    </button>
                  );
                })}
              </div>
            </div>
            {accountSelector}
          </>
        )}

        {formData.frequency === 'YEARLY' && accountSelector}

        <p className="form-help form-help-schedule">
          <Repeat size={13} aria-hidden="true" />
          <span>{scheduleHint}</span>
        </p>

        <div className="modal-form-row">
          <div className="form-group">
            <label className="form-label form-label-required">Data inizio</label>
            <input type="date" value={formData.startDate}
              onChange={(e) => {
                setFormData({ ...formData, startDate: e.target.value })
                clearError('startDate');
              }}
              aria-invalid={!!errors.startDate || undefined}
              aria-describedby={errors.startDate ? 'rec-start-err' : undefined}
              className="form-input" />
            <FieldError id="rec-start-err" message={errors.startDate} />
          </div>
          <div className="form-group">
            <label className="form-label">Data fine (opzionale)</label>
            <input type="date" value={formData.endDate}
              onChange={(e) => {
                setFormData({ ...formData, endDate: e.target.value })
                clearError('endDate');
              }}
              aria-invalid={!!errors.endDate || undefined}
              aria-describedby={errors.endDate ? 'rec-end-err' : undefined}
              className="form-input" />
            <FieldError id="rec-end-err" message={errors.endDate} />
          </div>
        </div>

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