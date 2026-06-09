import { useState, useEffect } from 'react';
import { CreditCard, Landmark, ChevronDown } from 'lucide-react';
import BaseModal from '../layout/ModalBase';
import { InputDecimal } from '../layout/InputNumberDecimal';
import FieldError from '../shared/FieldError';
import FormError from '../shared/FormError';
import { useFormValidation } from '../../hooks/useFormValidation';
import { useCreateAccount, useUpdateAccount, useAccounts } from '../../hooks/useAccounts';
import { useToast } from '../../contexts/ToastContext';
import type { Account, CreateAccountDTO, AccountType } from '../../types';

const COLORS = [
  '#0d9488', // teal — primary
  '#3b82f6', // blue
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#f43f5e', // rose
  '#78716c', // stone
];

const BILLING_DAYS = Array.from({ length: 31 }, (_, i) => i + 1);
// Giorni di chiusura ciclo selezionabili nelle opzioni avanzate: 1..30 come giorni
// fissi; "Fine mese" (valore 31) viene aggiunto a parte ed è il default. closingDay=31
// è interpretato dal backend come "ultimo giorno reale del mese" (clamping).
const CLOSING_END_OF_MONTH = '31';
const CLOSING_FIXED_DAYS = Array.from({ length: 30 }, (_, i) => i + 1);

interface AccountFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingAccount?: Account | null;
}

interface FormData {
  name: string;
  type: AccountType;
  color: string;
  openingBalance: number;
  creditLimit: number;
  billingDay: string;
  closingDay: string;
  linkedAccountId: string;
}

export default function AccountFormModal({ isOpen, onClose, editingAccount }: AccountFormModalProps) {
  const createMutation = useCreateAccount();
  const updateMutation = useUpdateAccount();
  const { data: allAccounts = [] } = useAccounts();
  const toast = useToast();

  const bankAccounts = allAccounts.filter((a) => a.type === 'BANK' && a.id !== editingAccount?.id);

  const [formData, setFormData] = useState<FormData>({
    name: '',
    type: 'BANK',
    color: COLORS[0],
    openingBalance: 0,
    creditLimit: 0,
    billingDay: '',
    closingDay: CLOSING_END_OF_MONTH,
    linkedAccountId: '',
  });
  const [submitError, setSubmitError] = useState<string | null>(null);
  // Le opzioni avanzate (giorno di chiusura ciclo) sono nascoste di default: la
  // chiusura è a fine mese. Si aprono se si modifica una CC con un giorno fisso.
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Sincronizza il form all'apertura (nuovo vs modifica). Gli hook girano sempre:
  // l'early-return per !isOpen sta DOPO gli hook, mai prima (Rules of Hooks).
  useEffect(() => {
    if (!isOpen) return;
    setFormData({
      name: editingAccount?.name ?? '',
      type: editingAccount?.type ?? 'BANK',
      color: editingAccount?.color ?? COLORS[0],
      openingBalance: Number(editingAccount?.openingBalance ?? 0),
      creditLimit: Number(editingAccount?.creditLimit ?? 0),
      billingDay: editingAccount?.billingDay != null ? String(editingAccount.billingDay) : '',
      closingDay: editingAccount?.closingDay != null ? String(editingAccount.closingDay) : CLOSING_END_OF_MONTH,
      linkedAccountId: editingAccount?.linkedAccountId ?? '',
    });
    setSubmitError(null);
    // Apri le avanzate solo se la carta ha un giorno di chiusura fisso (≠ fine mese).
    const cd = editingAccount?.closingDay;
    setShowAdvanced(cd != null && String(cd) !== CLOSING_END_OF_MONTH);
  }, [isOpen, editingAccount]);

  const isPending = createMutation.isPending || updateMutation.isPending;
  const isCC = formData.type === 'CREDIT_CARD';

  const { errors, validate, clearError } = useFormValidation<FormData>({
    name: (v) => {
      if (!v?.trim()) return 'Nome obbligatorio';
      if (v.trim().length < 2) return 'Minimo 2 caratteri';
      if (v.trim().length > 30) return 'Massimo 30 caratteri';
      return null;
    },
    billingDay: (v) => {
      if (!isCC) return null;
      if (!v) return null;
      const n = Number(v);
      if (n < 1 || n > 31) return 'Inserisci un giorno tra 1 e 31';
      return null;
    },
  });

  const set = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    clearError(field as any);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    if (!validate(formData)) return;

    const payload: CreateAccountDTO = {
      name: formData.name.trim(),
      type: formData.type,
      color: formData.color,
      // openingBalance solo alla creazione: in modifica non si tocca il saldo di partenza
      ...(!editingAccount && { openingBalance: formData.openingBalance ? Number(formData.openingBalance) : 0 }),
      ...(isCC && formData.creditLimit && { creditLimit: Number(formData.creditLimit) }),
      ...(isCC && formData.billingDay && { billingDay: Number(formData.billingDay) }),
      ...(isCC && formData.closingDay && { closingDay: Number(formData.closingDay) }),
      ...(isCC && formData.linkedAccountId && { linkedAccountId: formData.linkedAccountId }),
    };

    try {
      if (editingAccount) {
        await updateMutation.mutateAsync({ id: editingAccount.id, data: payload });
        toast.success('Conto aggiornato');
      } else {
        await createMutation.mutateAsync(payload);
        toast.success('Conto creato');
      }
      onClose();
    } catch (err: any) {
      if (err.response?.status === 403 && err.response?.data?.error?.includes('Limite')) {
        const limit = err.response.data.limit ?? 3;
        const canUpgrade = err.response.data.upgrade;
        setSubmitError(
          canUpgrade
            ? `Limite di ${limit} conti raggiunto. Passa a Pro per aggiungerne altri.`
            : `Hai raggiunto il limite massimo di ${limit} conti del piano Pro.`
        );
      } else {
        setSubmitError(err.response?.data?.error ?? 'Errore nel salvataggio. Riprova.');
      }
    }
  };

  if (!isOpen) return null;

  return (
    <BaseModal
      isOpen={isOpen}
      title={editingAccount ? 'Modifica conto' : 'Nuovo conto'}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="modal-form">
        <FormError message={submitError} />

        {/* Tipo (solo in creazione) */}
        {!editingAccount && (
          <div className="form-group">
            <label className="form-label">Tipo di conto</label>
            <div className="account-type-options">
              <button
                type="button"
                className={`account-type-option${formData.type === 'BANK' ? ' is-selected' : ''}`}
                onClick={() => set('type', 'BANK')}
              >
                <span className="account-type-option-icon"><Landmark size={22} /></span>
                <span className="account-type-option-label">Conto / Carta di debito</span>
              </button>
              <button
                type="button"
                className={`account-type-option${formData.type === 'CREDIT_CARD' ? ' is-selected' : ''}`}
                onClick={() => set('type', 'CREDIT_CARD')}
              >
                <span className="account-type-option-icon"><CreditCard size={22} /></span>
                <span className="account-type-option-label">Carta di credito</span>
              </button>
            </div>
          </div>
        )}

        {/* Nome */}
        <div className="form-group">
          <label className="form-label form-label-required">Nome</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => set('name', e.target.value)}
            className="form-input"
            placeholder={isCC ? 'Es. Visa Platino' : 'Es. Conto Principale'}
          />
          <FieldError message={errors.name} />
        </div>

        {/* Colore */}
        <div className="form-group">
          <label className="form-label">Colore</label>
          <div className="color-swatch-grid">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className={`color-swatch${formData.color === c ? ' is-selected' : ''}`}
                style={{ backgroundColor: c }}
                onClick={() => set('color', c)}
                aria-label={c}
              />
            ))}
          </div>
        </div>

        {/* Saldo / Debito iniziale — solo in creazione: è la configurazione di partenza.
            In modifica si tiene fuori per non alterare il saldo senza una transazione
            (il saldo è derivato: saldo iniziale + transazioni). */}
        {!editingAccount && (
          <InputDecimal
            setFormData={setFormData}
            formData={formData}
            field="openingBalance"
            allowNegative
            label={isCC ? 'Debito iniziale' : 'Saldo iniziale'}
            placeholder="0,00"
          />
        )}

        {/* Campi CC */}
        {isCC && (
          <>
            <div className="modal-form-row">
              <InputDecimal
                setFormData={setFormData}
                formData={formData}
                field="creditLimit"
                label="Limite di credito"
                placeholder="Es. 1500"
              />
              <div className="form-group">
                <label className="form-label">Giorno di addebito</label>
                <select
                  value={formData.billingDay}
                  onChange={(e) => set('billingDay', e.target.value)}
                  className="form-select"
                >
                  <option value="">-- Seleziona --</option>
                  {BILLING_DAYS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
                <FieldError message={errors.billingDay} />
                <p className="form-help">
                  Giorno in cui l'importo del ciclo viene prelevato dal conto collegato (es. il 15).
                </p>
              </div>
            </div>

            {bankAccounts.length > 0 && (
              <div className="form-group">
                <label className="form-label">Conto collegato per l'addebito</label>
                <select
                  value={formData.linkedAccountId}
                  onChange={(e) => set('linkedAccountId', e.target.value)}
                  className="form-select"
                >
                  <option value="">-- Nessuno --</option>
                  {bankAccounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
                <p className="form-help">
                  Conto da cui viene prelevato l'importo della carta a ogni addebito.
                </p>
              </div>
            )}

            {/* Opzioni avanzate: chiusura ciclo. Nascoste di default → fine mese. */}
            <button
              type="button"
              className={`form-advanced-toggle${showAdvanced ? ' is-open' : ''}`}
              onClick={() => setShowAdvanced((v) => !v)}
              aria-expanded={showAdvanced}
            >
              <ChevronDown size={16} />
              Opzioni avanzate
            </button>

            {showAdvanced && (
              <div className="form-group">
                <label className="form-label">Giorno di chiusura ciclo</label>
                <select
                  value={formData.closingDay}
                  onChange={(e) => set('closingDay', e.target.value)}
                  className="form-select"
                >
                  <option value={CLOSING_END_OF_MONTH}>Fine mese</option>
                  {CLOSING_FIXED_DAYS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
                <p className="form-help">
                  Ultimo giorno incluso nel ciclo. Con "Fine mese" le spese di un mese di calendario
                  formano un unico ciclo (consigliato).
                </p>
              </div>
            )}
          </>
        )}

        <div className="form-actions">
          <button type="button" onClick={onClose} className="btn btn-ghost btn-md">
            Annulla
          </button>
          <button type="submit" disabled={isPending} className="btn btn-primary btn-md">
            {isPending ? 'Salvataggio...' : editingAccount ? 'Aggiorna' : 'Crea'}
          </button>
        </div>
      </form>
    </BaseModal>
  );
}
