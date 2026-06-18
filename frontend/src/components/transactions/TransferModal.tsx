import { useState, useEffect } from 'react';
import { ArrowRight } from 'lucide-react';
import BaseModal from '../layout/ModalBase';
import { InputDecimal } from '../layout/InputNumberDecimal';
import { useCreateTransfer, useUpdateTransfer } from '../../hooks/useTransactions';
import { useToast } from '../../contexts/ToastContext';
import { useAccounts } from '../../hooks/useAccounts';
import { useFormValidation } from '../../hooks/useFormValidation';
import { useFormatCurrency } from '../../hooks/useFormatCurrency';
import { currencySymbol } from '../../utils/currency';
import FieldError from '../shared/FieldError';
import FormError from '../shared/FormError';
import AccountSelector from '../accounts/AccountSelector';
import type { CreateTransferDTO, Transaction } from '../../types';

const DESCRIPTION_MAX = 200;

interface TransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Conto di origine pre-selezionato (es. aprendo dal dettaglio conto). */
  defaultFromAccountId?: string;
  /** Gamba rappresentante di un trasferimento esistente da modificare. */
  editingTransfer?: Transaction | null;
}

export default function TransferModal({
  isOpen,
  onClose,
  defaultFromAccountId,
  editingTransfer,
}: TransferModalProps) {
  const createTransfer = useCreateTransfer();
  const updateTransfer = useUpdateTransfer();
  const toast = useToast();
  const { data: accounts = [] } = useAccounts();
  const { currency } = useFormatCurrency();

  const isEditing = !!editingTransfer?.transferId;

  // I trasferimenti sono consentiti solo tra conti bancari.
  const bankAccounts = accounts.filter((a) => a.type === 'BANK');

  const [formData, setFormData] = useState<CreateTransferDTO>({
    fromAccountId: '',
    toAccountId: '',
    amount: 0,
    date: new Date().toISOString().split('T')[0],
    description: '',
  });
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Inizializza all'apertura. In modifica deriva origine/destinazione dalla gamba
  // rappresentante (EXPENSE: questo conto = origine, peer = destinazione; INCOME:
  // viceversa). In creazione: origine = quello passato o il primo BANK,
  // destinazione = il primo BANK diverso dall'origine.
  useEffect(() => {
    if (!isOpen) return;
    if (editingTransfer?.transferId) {
      const isExpenseLeg = editingTransfer.type === 'EXPENSE';
      const from = isExpenseLeg ? editingTransfer.account?.id : editingTransfer.transferPeer?.id;
      const to = isExpenseLeg ? editingTransfer.transferPeer?.id : editingTransfer.account?.id;
      setFormData({
        fromAccountId: from ?? '',
        toAccountId: to ?? '',
        amount: Number(editingTransfer.amount),
        date: editingTransfer.date.split('T')[0],
        description: editingTransfer.description ?? '',
      });
      setSubmitError(null);
      return;
    }
    const from = defaultFromAccountId && bankAccounts.some((a) => a.id === defaultFromAccountId)
      ? defaultFromAccountId
      : bankAccounts[0]?.id ?? '';
    const to = bankAccounts.find((a) => a.id !== from)?.id ?? '';
    setFormData({
      fromAccountId: from,
      toAccountId: to,
      amount: 0,
      date: new Date().toISOString().split('T')[0],
      description: '',
    });
    setSubmitError(null);
    // Dipende da accounts.length (non dall'array, referenzialmente instabile) per
    // re-inizializzare quando i conti finiscono di caricare, senza azzerare il form
    // a ogni refetch mentre il modal è aperto.
  }, [isOpen, defaultFromAccountId, editingTransfer, accounts.length]);

  const { errors, validate, clearError } = useFormValidation<CreateTransferDTO>({
    amount: (value) => {
      if (!value || value <= 0) return 'Inserisci un importo valido maggiore di zero';
      if (value > 999999) return 'Importo troppo elevato';
      return null;
    },
    fromAccountId: (value) => (!value ? 'Seleziona il conto di origine' : null),
    toAccountId: (value, data) => {
      if (!value) return 'Seleziona il conto di destinazione';
      if (value === data.fromAccountId) return 'I due conti devono essere diversi';
      return null;
    },
  });

  const isPending = createTransfer.isPending || updateTransfer.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    if (!validate(formData)) return;
    try {
      if (isEditing && editingTransfer?.transferId) {
        await updateTransfer.mutateAsync({ transferId: editingTransfer.transferId, data: formData });
        toast.success('Trasferimento aggiornato con successo');
      } else {
        await createTransfer.mutateAsync(formData);
        toast.success('Trasferimento creato con successo');
      }
      onClose();
    } catch (error: any) {
      setSubmitError(error.response?.data?.error || 'Errore nel salvataggio. Riprova.');
    }
  };

  if (!isOpen) return null;

  // Conti selezionabili come destinazione: tutti i BANK tranne l'origine.
  const toAccounts = bankAccounts.filter((a) => a.id !== formData.fromAccountId);

  return (
    <BaseModal isOpen={isOpen} title={isEditing ? 'Modifica trasferimento' : 'Trasferimento tra conti'} onClose={onClose}>
      <form className="modal-form" onSubmit={handleSubmit}>
        <FormError message={submitError} />

        {bankAccounts.length < 2 ? (
          <p className="recurring-due-subtitle">
            Servono almeno due conti bancari per effettuare un trasferimento.
          </p>
        ) : (
          <>
            <div className="transfer-accounts-row">
              <AccountSelector
                accounts={bankAccounts}
                value={formData.fromAccountId}
                onChange={(id) => {
                  setFormData((prev) => ({
                    ...prev,
                    fromAccountId: id,
                    // Se la destinazione coincide con la nuova origine, spostala.
                    toAccountId: prev.toAccountId === id
                      ? bankAccounts.find((a) => a.id !== id)?.id ?? ''
                      : prev.toAccountId,
                  }));
                  clearError('fromAccountId');
                  clearError('toAccountId');
                }}
                label="Da"
              />
              <span className="transfer-arrow" aria-hidden="true">
                <ArrowRight size={18} />
              </span>
              <AccountSelector
                accounts={toAccounts}
                value={formData.toAccountId}
                onChange={(id) => {
                  setFormData((prev) => ({ ...prev, toAccountId: id }));
                  clearError('toAccountId');
                }}
                label="A"
              />
            </div>
            <FieldError id="transfer-accounts-err" message={errors.fromAccountId || errors.toAccountId} />

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
                  describedBy={errors.amount ? 'transfer-amount-err' : undefined}
                />
                <FieldError id="transfer-amount-err" message={errors.amount} />
              </div>
              <div className="form-group">
                <label className="form-label">Data</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="form-input"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Descrizione</label>
              <input
                type="text"
                value={formData.description}
                maxLength={DESCRIPTION_MAX}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="form-input"
                placeholder="Es. Giroconto risparmi"
              />
            </div>
          </>
        )}

        <div className="form-actions">
          <button type="button" onClick={onClose} className="btn btn-ghost btn-md">
            Annulla
          </button>
          {bankAccounts.length >= 2 && (
            <button type="submit" disabled={isPending} className="btn btn-primary btn-md">
              {isPending ? 'Salvataggio...' : isEditing ? 'Salva' : 'Trasferisci'}
            </button>
          )}
        </div>
      </form>
    </BaseModal>
  );
}
