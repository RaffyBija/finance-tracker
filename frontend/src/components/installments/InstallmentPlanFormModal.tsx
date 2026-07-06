import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import BaseModal from '../layout/ModalBase';
import { InputDecimal } from '../layout/InputNumberDecimal';
import AccountSelector from '../accounts/AccountSelector';
import FormError from '../shared/FormError';
import { useAccounts, useDefaultAccount } from '../../hooks/useAccounts';
import { useFormatCurrency } from '../../hooks/useFormatCurrency';
import { currencySymbol } from '../../utils/currency';
import { useToast } from '../../contexts/ToastContext';
import {
  useCreateInstallmentPlan,
  useUpdateInstallmentPlan,
} from '../../hooks/useInstallmentPlans';
import type {
  InstallmentPlan,
  Category,
  PlanDirection,
  InstallmentInput,
} from '../../types';

const TITLE_MAX = 80;

interface RateRow {
  key: number;
  amount: number;
  plannedDate: string;
  counterparty: string;
}

interface Props {
  isOpen: boolean;
  editingItem: InstallmentPlan | null;
  categories: Category[];
  onClose: () => void;
}

const today = () => new Date().toISOString().split('T')[0];
let rowKeySeq = 1;
const blankRow = (): RateRow => ({ key: rowKeySeq++, amount: 0, plannedDate: today(), counterparty: '' });

export default function InstallmentPlanFormModal({ isOpen, editingItem, categories, onClose }: Props) {
  const createMutation = useCreateInstallmentPlan();
  const updateMutation = useUpdateInstallmentPlan();
  const toast = useToast();
  const { data: accounts = [] } = useAccounts();
  const { data: defaultAccount } = useDefaultAccount();
  const { currency, formatCurrency } = useFormatCurrency();

  const [direction, setDirection] = useState<PlanDirection>('DEBT');
  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [notes, setNotes] = useState('');
  const [rows, setRows] = useState<RateRow[]>([blankRow()]);
  const [error, setError] = useState<string | null>(null);

  const isEdit = !!editingItem;
  const paidCount = editingItem
    ? editingItem.installments.filter((r) => r.isPaid).length
    : 0;

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    if (editingItem) {
      setDirection(editingItem.direction);
      setTitle(editingItem.title);
      setCategoryId(editingItem.categoryId ?? '');
      setAccountId(editingItem.accountId ?? defaultAccount?.id ?? '');
      setNotes(editingItem.notes ?? '');
      const unpaid = editingItem.installments
        .filter((r) => !r.isPaid)
        .map((r) => ({
          key: rowKeySeq++,
          amount: Number(r.amount),
          plannedDate: r.plannedDate.split('T')[0],
          counterparty: r.counterparty ?? '',
        }));
      setRows(unpaid.length > 0 ? unpaid : [blankRow()]);
    } else {
      setDirection('DEBT');
      setTitle('');
      setCategoryId('');
      setAccountId(defaultAccount?.id ?? '');
      setNotes('');
      setRows([blankRow()]);
    }
  }, [isOpen, editingItem, defaultAccount]);

  const catType = direction === 'CREDIT' ? 'INCOME' : 'EXPENSE';
  const filteredCategories = categories.filter((c) => c.type === catType);
  const isPending = createMutation.isPending || updateMutation.isPending;
  const total = rows.reduce((s, r) => s + Number(r.amount || 0), 0);

  const updateRow = (i: number, next: Partial<RateRow>) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...next } : r)));
  const addRow = () => setRows((prev) => [...prev, blankRow()]);
  const removeRow = (i: number) => setRows((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim() || title.trim().length < 2) {
      setError('Il titolo è obbligatorio.');
      return;
    }
    if (rows.length === 0) {
      setError('Aggiungi almeno una rata.');
      return;
    }
    for (const r of rows) {
      if (!r.amount || r.amount <= 0 || !r.plannedDate) {
        setError('Ogni rata richiede un importo maggiore di zero e una data.');
        return;
      }
    }

    const installments: InstallmentInput[] = rows.map((r) => ({
      amount: r.amount,
      plannedDate: r.plannedDate,
      counterparty: direction === 'CREDIT' && r.counterparty.trim() ? r.counterparty.trim() : null,
    }));

    try {
      if (editingItem) {
        await updateMutation.mutateAsync({
          id: editingItem.id,
          data: {
            title: title.trim(),
            categoryId: categoryId || undefined,
            accountId: accountId || undefined,
            notes: notes.trim() || undefined,
            installments,
          },
        });
        toast.success('Piano aggiornato con successo');
      } else {
        await createMutation.mutateAsync({
          direction,
          title: title.trim(),
          categoryId: categoryId || undefined,
          accountId: accountId || undefined,
          notes: notes.trim() || undefined,
          installments,
        });
        toast.success('Piano a rate creato con successo');
      }
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Errore nel salvataggio. Riprova.');
    }
  };

  if (!isOpen) return null;

  return (
    <BaseModal
      isOpen={isOpen}
      title={editingItem ? 'Modifica piano a rate' : 'Nuovo piano a rate'}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="modal-form">
        <FormError message={error} />

        <div className="form-group">
          <label className="form-label">Tipo</label>
          <div className="form-button-group">
            <button
              type="button"
              disabled={isEdit}
              onClick={() => { setDirection('DEBT'); setCategoryId(''); }}
              className={`btn-toggle ${direction === 'DEBT' ? 'btn-toggle-expense-active' : 'btn-toggle-inactive'}`}
            >
              Debito (pago)
            </button>
            <button
              type="button"
              disabled={isEdit}
              onClick={() => { setDirection('CREDIT'); setCategoryId(''); }}
              className={`btn-toggle ${direction === 'CREDIT' ? 'btn-toggle-income-active' : 'btn-toggle-inactive'}`}
            >
              Credito (incasso)
            </button>
          </div>
          {isEdit && <p className="form-help">Il tipo non è modificabile su un piano esistente.</p>}
        </div>

        <div className="form-group">
          <label className="form-label form-label-required">Titolo</label>
          <input
            type="text"
            value={title}
            maxLength={TITLE_MAX}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={direction === 'CREDIT' ? 'Es. Prestito a un amico' : 'Es. Acquisto a rate'}
            className="form-input"
          />
        </div>

        <div className="modal-form-row">
          <div className="form-group">
            <label className="form-label">Categoria (opzionale)</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="form-select"
            >
              <option value="">Nessuna categoria</option>
              {filteredCategories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
              ))}
            </select>
          </div>

          {accounts.length > 1 && (
            <AccountSelector
              accounts={accounts}
              value={accountId}
              onChange={setAccountId}
              label={direction === 'CREDIT' ? 'Conto di accredito' : 'Conto di addebito'}
            />
          )}
        </div>

        {/* ── Editor rate ── */}
        <div className="form-group">
          <div className="rate-editor-head">
            <label className="form-label">Rate</label>
            <span className="rate-editor-total">Totale {formatCurrency(total)}</span>
          </div>

          {isEdit && paidCount > 0 && (
            <p className="form-help rate-editor-locked">
              {paidCount} {paidCount === 1 ? 'rata già saldata' : 'rate già saldate'} restano invariate; qui modifichi solo quelle da saldare.
            </p>
          )}

          <div className="rate-editor-list">
            {rows.map((row, i) => (
              <div key={row.key} className="rate-edit-row">
                <InputDecimal
                  formData={row}
                  field="amount"
                  setFormData={(next: any) => updateRow(i, { amount: next.amount })}
                  label={`Importo rata ${i + 1}`}
                  hideLabel
                  currency={currencySymbol(currency)}
                  placeholder="0,00"
                />
                <input
                  type="date"
                  value={row.plannedDate}
                  onChange={(e) => updateRow(i, { plannedDate: e.target.value })}
                  className="form-input"
                  aria-label={`Data rata ${i + 1}`}
                />
                {direction === 'CREDIT' && (
                  <input
                    type="text"
                    value={row.counterparty}
                    onChange={(e) => updateRow(i, { counterparty: e.target.value })}
                    placeholder="Chi (es. Mario)"
                    className="form-input"
                    aria-label={`Controparte rata ${i + 1}`}
                  />
                )}
                <button
                  type="button"
                  className="btn-icon-danger rate-edit-remove"
                  onClick={() => removeRow(i)}
                  disabled={rows.length === 1}
                  aria-label={`Rimuovi rata ${i + 1}`}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>

          <button type="button" className="btn btn-ghost btn-sm rate-editor-add" onClick={addRow}>
            <Plus size={15} /> Aggiungi rata
          </button>
        </div>

        <div className="form-group">
          <label className="form-label">Note (opzionale)</label>
          <textarea
            value={notes}
            maxLength={300}
            onChange={(e) => setNotes(e.target.value)}
            className="form-input"
            rows={2}
            placeholder="Eventuali note..."
          />
        </div>

        <div className="form-actions">
          <button type="button" onClick={onClose} className="btn btn-ghost btn-md">
            Annulla
          </button>
          <button type="submit" disabled={isPending} className="btn btn-primary btn-md">
            {isPending ? 'Salvataggio...' : editingItem ? 'Aggiorna' : 'Crea piano'}
          </button>
        </div>
      </form>
    </BaseModal>
  );
}
