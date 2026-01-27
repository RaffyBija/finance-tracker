
import {useState} from "react";
import BaseModal from "../layout/ModalBase";
import type { CreateTransactionDTO, Category, Transaction,AlertPopUp } from "../../types";
import { transactionAPI} from "../../api/client";



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

  if(!isOpen) return null;
    // Form state
    const [formData, setFormData] = useState<CreateTransactionDTO>({
    amount: 0,
    type: 'EXPENSE',
    description: '',
    date: new Date().toISOString().split('T')[0],
    categoryId: '',
  });

  const [alertConfig,setAlertConfig] = useState <AlertPopUp>({
        messaggio: '',
        tipo: '',
        checked: false
      });


if(editingTransactionData && formData.amount === 0) {
  setFormData({
    amount: editingTransactionData.amount,
    type: editingTransactionData.type,
    description: editingTransactionData.description || '',
    date: editingTransactionData.date.split('T')[0],
    categoryId: editingTransactionData.categoryId || '',
  });
}

  const filteredCategories = categories.filter(cat => cat.type === formData.type);

  const handleSubmitEdit = async (e: React.FormEvent) => {
      let messaggio = '';
      e.preventDefault();
      try {
        if (editingTransactionData) {
          if(editingTransactionData.amount === formData.amount &&
            editingTransactionData.type === formData.type &&
            editingTransactionData.description === formData.description &&
            editingTransactionData.date === formData.date){
            setAlertConfig({...alertConfig, 
              messaggio:'Nessuna modifica apportata',
              tipo:'info',
              checked:true,
            });
              
              setTimeout(onClose,800);
              return;
            }
          await transactionAPI.update(editingTransactionData.id, formData);
          messaggio='Transazione aggiornata con successo';
        } else {
          await transactionAPI.create(formData);
          messaggio='Transazione creata con successo';
        }
        setAlertConfig({...alertConfig, 
          messaggio: messaggio,
          tipo: 'success',
          checked: true,
        });
        setTimeout(() => {onClose(); sentFeed();}, 800);
      } catch (error: any) {
        alert(error.response?.data?.error || 'Errore nel salvataggio');
      }
    };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const newTransaction: CreateTransactionDTO = {
      amount: Number(formData.amount),
      type: formData.type as "INCOME" | "EXPENSE",
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
      title={editingTransactionData ? 'Modifica Transazione' : 'Nuova Transazione'}
      onClose={onClose}
      feedAlert={alertConfig}
    >
            <form 
              className="modal-form"
              onSubmit=
                {editingTransactionData ? handleSubmitEdit : handleSubmit} 
            >
              <div>
                <label>Tipo</label>
                <div className="modal-buttons">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, type: 'INCOME', categoryId: '' })}
                    className={`modal-btn ${formData.type === 'INCOME' ? 'bg-green-600 text-white' : 'bg-gray-100'}`}
                  >
                    Entrata
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, type: 'EXPENSE', categoryId: '' })}
                    className={`modal-btn ${formData.type === 'EXPENSE' ? 'bg-red-600 text-white' : 'bg-gray-100'}`}
                  >
                    Uscita
                  </button>
                </div>
              </div>
              <div>
                <label>Importo (€)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) })}
                  required
                />
              </div>
              <div>
                <label >Categoria</label>
                <select
                  value={formData.categoryId}
                  onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                 
                >
                  <option value="">Nessuna categoria</option>
                  {filteredCategories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label >Descrizione</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Data</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  required
                />
              </div>
                   <div className="modal-buttons">
                <button
                  type="submit"
                  className="modal-btn modal-btn-primary"
                >
                  Salva
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="modal-btn modal-btn-secondary"
                >
                  Annulla
                </button>
        </div>
            </form>
  
    </BaseModal>
  );
}