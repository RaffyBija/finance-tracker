import { useState, useEffect } from 'react';
import { Sparkles, Split, Plus, X } from 'lucide-react';
import BaseModal from '../layout/ModalBase';
import { InputDecimal } from '../layout/InputNumberDecimal';
import { useCreateTransaction, useUpdateTransaction } from '../../hooks/useTransactions';
import { useToast } from '../../contexts/ToastContext';
import type { Transaction, Category, CreateTransactionDTO, TransactionItemInput } from '../../types';
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
import { useSuggestedCategory } from '../../hooks/useSuggestedCategory';

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
  // true quando categoryId è stato valorizzato dal suggerimento automatico
  // (serve a mostrare il badge "Suggerito" finché l'utente non sceglie a mano).
  const [autoSuggested, setAutoSuggested] = useState(false);
  // Modalità "divisa": l'importo è ripartito su più categorie (solo EXPENSE).
  // Le righe vivono in formData.items; la categoria singola del padre è ignorata.
  const [splitMode, setSplitMode] = useState(false);
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
    const existingItems = editingTransactionData?.items ?? [];
    const startSplit = existingItems.length > 0;
    const init: CreateTransactionDTO = editingTransactionData ? {
      amount: editingTransactionData.amount,
      type: editingTransactionData.type,
      description: editingTransactionData.description ?? '',
      date: editingTransactionData.date.split('T')[0],
      categoryId: editingTransactionData.categoryId ?? '',
      accountId: editingTransactionData.accountId ?? defaultAccount?.id ?? '',
      ...(startSplit && {
        items: existingItems.map((i) => ({
          amount: i.amount,
          categoryId: i.categoryId ?? '',
        })),
      }),
    } : blankTransaction();
    setFormData(init);
    guard.capture(init);
    setSubmitError(null);
    setAutoSuggested(false);
    setSplitMode(startSplit);
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
    // In modalità divisa la categoria vive sulle righe, non sul padre.
    if (splitMode) return null;
    if (!value) return 'La categoria è obbligatoria';
    return null;
  }
});

  // ── Righe della transazione divisa ──────────────────────────────────────────
  const splitItems: TransactionItemInput[] = formData.items ?? [];
  const splitTotal = splitItems.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  // Quanto resta da assegnare rispetto all'importo totale (hero).
  const splitRemaining = Math.round((Number(formData.amount || 0) - splitTotal) * 100) / 100;

  const updateSplitRow = (index: number, patch: Partial<TransactionItemInput>) => {
    setFormData((prev) => {
      const rows = [...(prev.items ?? [])];
      rows[index] = { ...rows[index], ...patch };
      return { ...prev, items: rows };
    });
    setSubmitError(null);
  };

  const addSplitRow = () => {
    setFormData((prev) => ({
      ...prev,
      items: [...(prev.items ?? []), { amount: 0, categoryId: '' }],
    }));
  };

  const removeSplitRow = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      items: (prev.items ?? []).filter((_, i) => i !== index),
    }));
  };

  // Attiva la modalità divisa: azzera la categoria singola e semina due righe.
  const enableSplit = () => {
    setSplitMode(true);
    setAutoSuggested(false);
    setFormData((prev) => ({
      ...prev,
      categoryId: '',
      items: prev.items && prev.items.length >= 2 ? prev.items : [
        { amount: 0, categoryId: '' },
        { amount: 0, categoryId: '' },
      ],
    }));
  };

  // Torna alla categoria singola: rimuove le righe.
  const disableSplit = () => {
    setSplitMode(false);
    setSubmitError(null);
    setFormData((prev) => {
      const { items, ...rest } = prev;
      return rest;
    });
  };

  // Suggerimento categoria dallo storico: solo su nuova transazione. Resta attivo
  // anche dopo aver applicato un suggerimento (`autoSuggested`), così cambiando la
  // descrizione la categoria viene riaggiornata invece di restare "bloccata" sul
  // primo match. Si disattiva solo quando l'utente sceglie a mano (categoria
  // valorizzata con autoSuggested=false): una scelta manuale non va mai sovrascritta.
  const suggestEnabled =
    !editingTransactionData && !splitMode && (!formData.categoryId || autoSuggested);
  const { suggestedCategoryId, isFetching: isSuggesting } = useSuggestedCategory(
    formData.description ?? '',
    formData.type,
    suggestEnabled,
  );

  // Applica (o riaggiorna) il suggerimento finché la categoria è gestita in
  // automatico — `suggestEnabled` copre sia il caso vuoto sia quello già
  // auto-suggerito — e l'id suggerito esiste tra quelle del tipo corrente
  // (guard difensivo). Le dipendenze sono input stabili (`categories` dalla
  // query, `formData.type` primitivo): NON `filteredCategories`, ricreato a
  // ogni render.
  useEffect(() => {
    if (!suggestEnabled) return;
    // Nessun match per la descrizione corrente: se la categoria era stata messa
    // in automatico, azzerala invece di lasciare quella precedente (altrimenti si
    // salverebbe con una categoria mai scelta). Restiamo in modalità automatica.
    // Aspetta che la query sia conclusa (`!isSuggesting`) per non azzerare durante
    // il fetch tra una descrizione e l'altra.
    if (!suggestedCategoryId) {
      if (!isSuggesting && autoSuggested) {
        setFormData((prev) => (prev.categoryId ? { ...prev, categoryId: '' } : prev));
      }
      return;
    }
    const exists = categories.some(
      (cat) => cat.id === suggestedCategoryId && cat.type === formData.type,
    );
    if (!exists) return;
    setFormData((prev) => ({ ...prev, categoryId: suggestedCategoryId }));
    setAutoSuggested(true);
    clearError('categoryId');
  }, [suggestedCategoryId, isSuggesting, suggestEnabled, autoSuggested, categories, formData.type, clearError]);


  // Valida e salva. Ritorna true se ok, così i chiamanti decidono se chiudere
  // (Crea) o ripartire con un form vuoto (Salva e aggiungi). In modifica, se nulla
  // è cambiato lo segnala e ritorna true senza chiamare l'API.
  const persist = async (): Promise<boolean> => {
    setSubmitError(null);
    if (!validate(formData)) return false;

    // Validazione righe della transazione divisa.
    if (splitMode) {
      if (splitItems.length < 2) {
        setSubmitError('Una transazione divisa richiede almeno due righe');
        return false;
      }
      if (splitItems.some((r) => !r.categoryId)) {
        setSubmitError('Scegli una categoria per ogni riga');
        return false;
      }
      if (splitItems.some((r) => !r.amount || Number(r.amount) <= 0)) {
        setSubmitError('Inserisci un importo valido per ogni riga');
        return false;
      }
      if (Math.abs(splitRemaining) > 0.01) {
        setSubmitError('La somma delle righe deve corrispondere all\'importo totale');
        return false;
      }
    }

    // Payload: in modalità divisa invia le righe e azzera la categoria singola;
    // altrimenti invia items=[] così, in modifica, eventuali righe vengono rimosse.
    const payload: CreateTransactionDTO = splitMode
      ? {
          ...formData,
          categoryId: undefined,
          items: splitItems.map((r) => ({ amount: Number(r.amount), categoryId: r.categoryId })),
        }
      : { ...formData, items: [] };

    try {
      if (editingTransactionData) {
        const wasSplit = (editingTransactionData.items?.length ?? 0) > 0;
        const unchanged =
          !splitMode && !wasSplit &&
          editingTransactionData.amount === formData.amount &&
          editingTransactionData.type === formData.type &&
          editingTransactionData.description === formData.description &&
          editingTransactionData.date.split('T')[0] === formData.date &&
          editingTransactionData.categoryId === formData.categoryId;

        if (unchanged) {
          toast.info('Nessuna modifica apportata');
          return true;
        }
        await updateMutation.mutateAsync({ id: editingTransactionData.id, data: payload });
        toast.success('Transazione aggiornata con successo');
      } else {
        await createMutation.mutateAsync(payload);
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
    setAutoSuggested(false);
    setSplitMode(false);
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
              onClick={() => {
                // Le entrate non sono divisibili: esci dalla modalità divisa.
                setFormData((prev) => { const { items, ...rest } = prev; return { ...rest, type: 'INCOME', categoryId: '' }; });
                setAutoSuggested(false);
                setSplitMode(false);
              }}
              className={`btn-toggle ${
                formData.type === 'INCOME' ? 'btn-toggle-income-active' : 'btn-toggle-inactive'
              }`}
            >
              Entrata
            </button>
            <button
              type="button"
              onClick={() => { setFormData({ ...formData, type: 'EXPENSE', categoryId: '' }); setAutoSuggested(false); }}
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
              label="Importo"
              hero
              currency={currencySymbol(currency)}
              placeholder="0,00"
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

        {!splitMode ? (
          <div className="form-group">
            <label className="form-label form-label-required">
              Categoria
              {autoSuggested && formData.categoryId === suggestedCategoryId && (
                <span className="form-label-suggest">
                  <Sparkles size={13} aria-hidden="true" /> Suggerito
                </span>
              )}
            </label>
            <select
              value={formData.categoryId}
              onChange={(e) => {
                setFormData({ ...formData, categoryId: e.target.value })
                setAutoSuggested(false);
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
            {formData.type === 'EXPENSE' && (
              <button type="button" onClick={enableSplit} className="split-toggle-btn">
                <Split size={14} aria-hidden="true" /> Dividi su più categorie
              </button>
            )}
          </div>
        ) : (
          <div className="form-group">
            <div className="split-header">
              <label className="form-label form-label-required">Dividi tra categorie</label>
              <button type="button" onClick={disableSplit} className="split-toggle-btn">
                Categoria singola
              </button>
            </div>

            <div className="split-rows">
              {splitItems.map((row, i) => (
                <div className="split-row" key={i}>
                  <select
                    value={row.categoryId ?? ''}
                    onChange={(e) => updateSplitRow(i, { categoryId: e.target.value })}
                    className="form-select split-row-category"
                    aria-label={`Categoria riga ${i + 1}`}
                  >
                    <option value="">Categoria…</option>
                    {filteredCategories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.icon} {cat.name}
                      </option>
                    ))}
                  </select>
                  <div className="split-row-amount">
                    <InputDecimal
                      setFormData={(updated: { amount: number }) => updateSplitRow(i, { amount: updated.amount })}
                      formData={{ amount: row.amount }}
                      label={`Importo riga ${i + 1}`}
                      hideLabel
                      placeholder="0,00"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeSplitRow(i)}
                    className="split-row-remove"
                    aria-label={`Rimuovi riga ${i + 1}`}
                    disabled={splitItems.length <= 2}
                  >
                    <X size={16} aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>

            <button type="button" onClick={addSplitRow} className="split-add-btn">
              <Plus size={14} aria-hidden="true" /> Aggiungi riga
            </button>

            <div className={`split-remainder ${Math.abs(splitRemaining) < 0.01 ? 'is-balanced' : 'is-unbalanced'}`}>
              {Math.abs(splitRemaining) < 0.01
                ? 'Tutto assegnato'
                : splitRemaining > 0
                  ? `Da assegnare: ${currencySymbol(currency)} ${splitRemaining.toFixed(2).replace('.', ',')}`
                  : `In eccesso: ${currencySymbol(currency)} ${Math.abs(splitRemaining).toFixed(2).replace('.', ',')}`}
            </div>
          </div>
        )}

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