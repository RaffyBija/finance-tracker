import { useState } from 'react';
import BaseModal from '../layout/ModalBase';
import { InputDecimal } from '../layout/InputNumberDecimal';
import type {
  CreateTransactionDTO,
  Category,
  Transaction,
  AlertPopUp,
} from '../../types';
import { useCreateTransaction, useUpdateTransaction } from '../../hooks/useTransactions';

interface TransactionModalProps {
  isOpen: boolean;
  categories: Category[];
  editingTransactionData?: Transaction | null;
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
  if (!isOpen) return null;

  // ✅ Usa i mutation hooks — invalidateQueries è già dentro onSuccess
  const createMutation = useCreateTransaction();
  const updateMutation = useUpdateTransaction();

  const [formData, setFormData] = useState<CreateTransactionDTO>({
    amount: 0,
    type: 'EXPENSE',
    description: '',
    date: new Date().toISOString().split('T')[0],
    categoryId: '',
  });

  const [alertConfig, setAlertConfig] = useState<AlertPopUp>({
    messaggio: '',
    tipo: '',
    checked: false,
  });

  if (editingTransactionData && formData.amount === 0) {
    setFormData({
      amount: editingTransactionData.amount,
      type: editingTransactionData.type,
      description: editingTransactionData.description || '',
      date: editingTransactionData.date.split('T')[0],
      categoryId: editingTransactionData.categoryId || '',
    });
  }

  const filteredCategories = categories.filter((cat) => cat.type === formData.type);
  const isLoading = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let messaggio = '';

    try {
      if (editingTransactionData) {
        // Nessuna modifica apportata
        if (
          editingTransactionData.amount === formData.amount &&
          editingTransactionData.type === formData.type &&
          editingTransactionData.description === formData.description &&
          editingTransactionData.date.split('T')[0] === formData.date &&
          editingTransactionData.categoryId === formData.categoryId
        ) {
          setAlertConfig({ messaggio: 'Nessuna modifica apportata', tipo: 'info', checked: true });
          setTimeout(onClose, 800);
          return;
        }
        // ✅ Usa il mutation hook → invalida automaticamente la cache
        await updateMutation.mutateAsync({ id: editingTransactionData.id, data: formData });
        messaggio = 'Transazione aggiornata con successo';
      } else {
        // ✅ Usa il mutation hook → invalida automaticamente la cache
        await createMutation.mutateAsync(formData);
        messaggio = 'Transazione creata con successo';
      }

      setAlertConfig({ messaggio, tipo: 'success', checked: true });
      setTimeout(() => {
        onClose();
        sentFeed();
      }, 800);
    } catch (error: any) {
      setAlertConfig({
        messaggio: error.response?.data?.error || 'Errore nel salvataggio',
        tipo: 'error',
        checked: true,
      });
    }
  };

  return (
    <BaseModal
      isOpen={isOpen}
      title={editingTransactionData ? 'Modifica Transazione' : 'Nuova Transazione'}
      onClose={onClose}
      feedAlert={alertConfig}
    >
      <form className="modal-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label">Tipo</label>
          <div className="form-button-group">
            <button
              type="button"
              onClick={() => setFormData({ ...formData, type: 'INCOME', categoryId: '' })}
              className={`btn-toggle flex-1 ${
                formData.type === 'INCOME' ? 'btn-toggle-income-active' : 'btn-toggle-inactive'
              }`}
            >
              Entrata
            </button>
            <button
              type="button"
              onClick={() => setFormData({ ...formData, type: 'EXPENSE', categoryId: '' })}
              className={`btn-toggle flex-1 ${
                formData.type === 'EXPENSE' ? 'btn-toggle-expense-active' : 'btn-toggle-inactive'
              }`}
            >
              Uscita
            </button>
          </div>
        </div>

        <div className="form-group">
          <InputDecimal
          setFormData={setFormData}
          formData={formData}
          label = {"Importo (€)"}
        />
        </div>

        <div className="form-group">
          <label className="form-label">Descrizione</label>
          <input
            type="text"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="form-input"
            placeholder="Es. Spesa supermercato"
          />
        </div>

        <div className="form-group">
          <label className="form-label">Data</label>
          <input
            type="date"
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            className="form-input"
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label">Categoria</label>
          <select
            value={formData.categoryId}
            onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
            className="form-select"
          >
            <option value="">Senza categoria</option>
            {filteredCategories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.icon} {cat.name}
              </option>
            ))}
          </select>
        </div>

        <div className="form-actions">
          <button type="button" onClick={onClose} className="btn btn-ghost btn-md">
            Annulla
          </button>
          <button type="submit" disabled={isLoading} className="btn btn-primary btn-md">
            {isLoading ? 'Salvataggio...' : editingTransactionData ? 'Aggiorna' : 'Crea'}
          </button>
        </div>
      </form>
    </BaseModal>
  );
}