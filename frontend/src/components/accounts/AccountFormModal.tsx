import { useState } from 'react';
import { CreditCard, Landmark } from 'lucide-react';
import BaseModal from '../layout/ModalBase';
import FieldError from '../shared/FieldError';
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

interface AccountFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingAccount?: Account | null;
}

interface FormData {
  name: string;
  type: AccountType;
  color: string;
  openingBalance: string;
  creditLimit: string;
  billingDay: string;
  linkedAccountId: string;
}

export default function AccountFormModal({ isOpen, onClose, editingAccount }: AccountFormModalProps) {
  if (!isOpen) return null;

  const createMutation = useCreateAccount();
  const updateMutation = useUpdateAccount();
  const { data: allAccounts = [] } = useAccounts();
  const toast = useToast();

  const bankAccounts = allAccounts.filter((a) => a.type === 'BANK' && a.id !== editingAccount?.id);

  const [formData, setFormData] = useState<FormData>({
    name: editingAccount?.name ?? '',
    type: editingAccount?.type ?? 'BANK',
    color: editingAccount?.color ?? COLORS[0],
    openingBalance: editingAccount
      ? String(editingAccount.openingBalance ?? 0)
      : '0',
    creditLimit: editingAccount?.creditLimit != null
      ? String(editingAccount.creditLimit)
      : '',
    billingDay: editingAccount?.billingDay != null
      ? String(editingAccount.billingDay)
      : '',
    linkedAccountId: editingAccount?.linkedAccountId ?? '',
  });

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
    if (!validate(formData)) return;

    const payload: CreateAccountDTO = {
      name: formData.name.trim(),
      type: formData.type,
      color: formData.color,
      openingBalance: formData.openingBalance ? Number(formData.openingBalance) : 0,
      ...(isCC && formData.creditLimit && { creditLimit: Number(formData.creditLimit) }),
      ...(isCC && formData.billingDay && { billingDay: Number(formData.billingDay) }),
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
      if (err.response?.data?.upgrade) {
        toast.error('Limite di 3 conti raggiunto. Passa a Plus per aggiungerne altri.');
      } else {
        toast.error(err.response?.data?.error ?? 'Errore nel salvataggio');
      }
    }
  };

  return (
    <BaseModal
      isOpen={isOpen}
      title={editingAccount ? 'Modifica conto' : 'Nuovo conto'}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="modal-form">

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
          <label className="form-label">Nome</label>
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
          <div className="account-color-picker">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className={`account-color-swatch${formData.color === c ? ' is-selected' : ''}`}
                style={{ backgroundColor: c }}
                onClick={() => set('color', c)}
                aria-label={c}
              />
            ))}
          </div>
        </div>

        {/* Saldo / Debito iniziale */}
        <div className="form-group">
          <label className="form-label">
            {isCC ? 'Debito attuale' : 'Saldo iniziale'}
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={formData.openingBalance}
            onChange={(e) => set('openingBalance', e.target.value)}
            className="form-input"
            placeholder="0,00"
          />
        </div>

        {/* Campi CC */}
        {isCC && (
          <>
            <div className="modal-form-row">
              <div className="form-group">
                <label className="form-label">Limite di credito</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.creditLimit}
                  onChange={(e) => set('creditLimit', e.target.value)}
                  className="form-input"
                  placeholder="Es. 1500"
                />
              </div>
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
