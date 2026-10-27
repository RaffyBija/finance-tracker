import { useState, useEffect } from 'react';
import BaseModal from '../layout/ModalBase';
import type { Budget, Category, CreateBudgetDTO, BudgetPeriod, BudgetRollover } from '../../types';
import { useCreateBudget, useUpdateBudget } from '../../hooks/useBudgets';
import { useToast } from '../../contexts/ToastContext';
import { InputDecimal } from '../layout/InputNumberDecimal';
import { useFormValidation } from '../../hooks/useFormValidation';
import FieldError from '../shared/FieldError';
import FormError from '../shared/FormError';
import CategoryPicker from '../categories/CategoryPicker';
import { useAuth } from '../../contexts/AuthContext';
import { apiError } from '../../utils/apiError';
import { usePayPeriod } from '../../hooks/useAnalytics';
import { formatDayMonth } from '../../utils/date';
import { budgetFormChanged } from '../../utils/budget';
import { addDays, endOfMonth, endOfWeek, endOfYear, startOfMonth, startOfWeek, startOfYear } from 'date-fns';

// Finestra del periodo corrente per il budget, calcolata lato client solo per l'anteprima
// nel form (il calcolo vero è del backend). Periodo di paga: da payPeriod, altrimenti mese.
function currentWindowLabel(
  period: BudgetPeriod,
  pay: { configured: boolean; start: string; nextPayday: string } | undefined,
): string {
  const now = new Date();
  let start: Date;
  let end: Date;
  if (period === 'PAY_PERIOD' && pay?.configured) {
    start = new Date(`${pay.start}T00:00:00`);
    end = addDays(new Date(`${pay.nextPayday}T00:00:00`), -1);
  } else if (period === 'WEEKLY') {
    start = startOfWeek(now, { weekStartsOn: 1 });
    end = endOfWeek(now, { weekStartsOn: 1 });
  } else if (period === 'YEARLY') {
    start = startOfYear(now);
    end = endOfYear(now);
  } else {
    start = startOfMonth(now);
    end = endOfMonth(now);
  }
  return `${formatDayMonth(start)} – ${formatDayMonth(end)}`;
}

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
  const { user } = useAuth();
  const payConfigured = !!user?.salaryCategoryId || !!user?.payDay;

  const [formData, setFormData] = useState<CreateBudgetDTO>({
    name: '',
    amount: 0,
    categoryId: '',
    period: 'MONTHLY',
    rollover: 'NONE',
    startDate: '',
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
        rollover: editingItem.rollover ?? 'NONE',
        startDate: editingItem.startDate.split('T')[0],
        endDate: editingItem.endDate ? editingItem.endDate.split('T')[0] : '',
      });
    } else if (!editingItem && isOpen) {
      setFormData({
        name: '',
        amount: 0,
        categoryId: '',
        period: 'MONTHLY',
        rollover: 'NONE',
        startDate: '',
        endDate: '',
      });
    }
  }, [editingItem, isOpen]);

  const isPending = createMutation.isPending || updateMutation.isPending;
  const { data: payPeriod } = usePayPeriod(isOpen && formData.period === 'PAY_PERIOD');
  const windowLabel =
    editingItem && editingItem.period === formData.period && editingItem.periodLabel
      ? editingItem.periodLabel
      : currentWindowLabel(formData.period, payPeriod);

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
  // "Attivo da" è sempre opzionale: in creazione vuoto = inizio del periodo corrente, in
  // modifica vuoto = si lascia invariata la data salvata (il backend ignora il campo assente).
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
    // In modifica, se non è cambiato nulla non serve chiamare il server.
    if (editingItem && !budgetFormChanged(formData, editingItem)) {
      toast.info('Nessuna modifica apportata');
      onClose();
      return;
    }
    // startDate vuota = non inviata: il backend ancora il budget all'inizio del periodo corrente.
    const payload: CreateBudgetDTO = { ...formData, startDate: formData.startDate || undefined };
    try {
      if (editingItem) {
        await updateMutation.mutateAsync({ id: editingItem.id, data: payload });
        toast.success('Budget aggiornato con successo');
      } else {
        await createMutation.mutateAsync(payload);
        toast.success('Budget creato con successo');
      }
      onClose();
      onSuccess();
    } catch (error) {
      setSubmitError(apiError(error, 'Errore nel salvataggio. Riprova.'));
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
            <CategoryPicker
              categories={categories}
              type="EXPENSE"
              value={formData.categoryId ?? ''}
              onChange={(id) => {
                setFormData({ ...formData, categoryId: id });
                clearError('categoryId');
              }}
              label="Categoria (opzionale)"
              allowEmpty
              emptyLabel="Tutte le spese (budget globale)"
              allowCreate={false}
            />
            <p className="form-help">Un budget su una macro-categoria conta anche le sue sotto-categorie.</p>
            <FieldError message={errors.categoryId} />
          </div>
        </div>

        <p className="form-help">
          Un budget è un tetto sulla <strong>spesa variabile</strong>. Ricorrenti, pianificate e rate sono
          impegni fissi: non vengono conteggiate qui.
        </p>

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
            <option value="PAY_PERIOD">Periodo di paga</option>
          </select>
          <p className="form-help">
            {formData.period === 'PAY_PERIOD'
              ? payConfigured
                ? 'Si azzera a ogni stipendio: il periodo va da un accredito al successivo.'
                : 'Periodo di paga non impostato (Impostazioni → Preferenze): finché non lo imposti il budget segue il mese solare.'
              : 'Il budget si azzera automaticamente a ogni periodo. Lo storico di ogni periodo resta consultabile dal dettaglio.'}
            {' '}Questo periodo: <strong>{windowLabel}</strong>.
          </p>
        </div>

        <div className="form-group">
          <label className="form-label">Riporto a fine periodo</label>
          <select
            value={formData.rollover}
            onChange={(e) =>
              setFormData({ ...formData, rollover: e.target.value as BudgetRollover })
            }
            className="form-select"
          >
            <option value="NONE">Nessuno</option>
            <option value="SURPLUS">Solo avanzo</option>
            <option value="FULL">Avanzo e sforamento</option>
          </select>
          <p className="form-help">
            <strong>Nessuno</strong>: ogni periodo riparte dall'importo pieno.{' '}
            <strong>Solo avanzo</strong>: ciò che non spendi si aggiunge al periodo
            successivo (uno sforamento non penalizza). <strong>Avanzo e sforamento</strong>:
            si riportano sia l'avanzo sia il debito, riducendo il budget se hai speso troppo.
          </p>
        </div>

        <div className="modal-form-row">
          <div className="form-group">
            <label className="form-label">Attivo da (opzionale)</label>
            <input
              type="date"
              value={formData.startDate}
              onChange={(e) => {
                setFormData({ ...formData, startDate: e.target.value })
                clearError('startDate');
              }}
              className="form-input"
            />
            <p className="form-help">
              {editingItem
                ? 'Le spese contano da questa data (se creato senza data: dall\'inizio del periodo). Vuoto: resta invariata.'
                : "Vuoto: dall'inizio del periodo corrente."}
            </p>
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
          <button type="button" onClick={onClose} className="btn btn-ghost btn-md btn-cancel">
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