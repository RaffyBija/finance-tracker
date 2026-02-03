import { useState } from 'react';
import BaseModal from '../layout/ModalBase';
import {InputDecimal} from '../layout/InputNumberDecimal'
import type {
  CreateTransactionDTO,
  Category,
  Transaction,
  AlertPopUp,
} from '../../types';
import { transactionAPI } from '../../api/client';

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
 
  // Form state
  const [formData, setFormData] = useState<CreateTransactionDTO>({
    amount: 0 ,
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

  const handleSubmitEdit = async (e: React.FormEvent) => {
    let messaggio = '';
    e.preventDefault();
    try {
      if (editingTransactionData) {
        if (
          editingTransactionData.amount === formData.amount &&
          editingTransactionData.type === formData.type &&
          editingTransactionData.description === formData.description &&
          editingTransactionData.date === formData.date
        ) {
          setAlertConfig({
            ...alertConfig,
            messaggio: 'Nessuna modifica apportata',
            tipo: 'info',
            checked: true,
          });

          setTimeout(onClose, 800);
          return;
        }
        await transactionAPI.update(editingTransactionData.id, formData);
        messaggio = 'Transazione aggiornata con successo';
      } else {
        await transactionAPI.create(formData);
        messaggio = 'Transazione creata con successo';
      }
      setAlertConfig({
        ...alertConfig,
        messaggio: messaggio,
        tipo: 'success',
        checked: true,
      });
      setTimeout(() => {
        onClose();
        sentFeed();
      }, 800);
    } catch (error: any) {
      alert(error.response?.data?.error || 'Errore nel salvataggio');
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const newTransaction: CreateTransactionDTO = {
      amount: Number(formData.amount),
      type: formData.type as 'INCOME' | 'EXPENSE',
      categoryId: formData.categoryId as string,
      date: formData.date as string,
      description: formData.description as string,
    };

    transactionAPI
      .create(newTransaction)
      .then(() => {
        onClose();
        sentFeed();
      })
      .catch(console.error);
  };

  

  return (
    <BaseModal
      isOpen={isOpen}
      title={
        editingTransactionData ? 'Modifica Transazione' : 'Nuova Transazione'
      }
      onClose={onClose}
      feedAlert={alertConfig}
    >
      <form
        className="modal-form"
        onSubmit={editingTransactionData ? handleSubmitEdit : handleSubmit}
      >
        <div className="form-group">
          <label className="form-label">Tipo</label>
          <div className="form-button-group">
            <button
              type="button"
              onClick={() =>
                setFormData({ ...formData, type: 'INCOME', categoryId: '' })
              }
              className={`btn-toggle flex-1 ${
                formData.type === 'INCOME'
                  ? 'btn-toggle-income-active'
                  : 'btn-toggle-inactive'
              }`}
            >
              Entrata
            </button>
            <button
              type="button"
              onClick={() =>
                setFormData({ ...formData, type: 'EXPENSE', categoryId: '' })
              }
              className={`btn-toggle flex-1 ${
                formData.type === 'EXPENSE'
                  ? 'btn-toggle-expense-active'
                  : 'btn-toggle-inactive'
              }`}
            >
              Uscita
            </button>
          </div>
        </div>
        {/* <div className="form-group">
          <label className="form-label">Importo (€)</label>
          <input
            type="text"
            value={rawAmount}
            onChange={(e) => setRawAmount(handleNormalizeNumberInput(e.target.value))}
            onBlur = {handleFixNumberInput}
            onFocus={(e)=>{
              e.target.value === '0' && (e.target.value = '')
            }}
            className="form-input"
            pattern="[0-9]*[.,]?[0-9]*"
            inputMode="decimal"
            required
          />
        </div> */}
        {<InputDecimal
          setFormData={setFormData}
          formData={formData}
          label = {"Importo (€)"}
        />}
        <div className="form-group">
          <label className="form-label">Categoria</label>
          <select
            value={formData.categoryId}
            onChange={(e) =>
              setFormData({ ...formData, categoryId: e.target.value })
            }
            className="form-select"
          >
            <option value="">Nessuna categoria</option>
            {filteredCategories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Descrizione</label>
          <input
            type="text"
            value={formData.description}
            onChange={(e) =>
              setFormData({ ...formData, description: e.target.value })
            }
            className="form-input"
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
        <div className="form-button-group">
          <button type="submit" className="btn btn-primary flex-1">
            Salva
          </button>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary flex-1"
          >
            Annulla
          </button>
        </div>
      </form>
    </BaseModal>
  );
}