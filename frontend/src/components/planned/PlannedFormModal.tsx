import { useState, useEffect } from 'react';
import BaseModal from '../layout/ModalBase';
import type { PlannedTransaction, Category, CreatePlannedTransactionDTO, AlertPopUp } from '../../types';
import { plannedApi } from '../../api/planned';
import { InputDecimal } from '../layout/InputNumberDecimal';
interface PlannedFormModalProps {
  isOpen: boolean;
  editingItem: PlannedTransaction | null;
  categories: Category[];
  onClose: () => void;
  onSuccess: () => void;
}

/**
 * Modal form per creare/modificare transazioni pianificate
 * Usa BaseModal come wrapper riutilizzabile
 */
export default function PlannedFormModal({
  isOpen,
  editingItem,
  categories,
  onClose,
  onSuccess,
}: PlannedFormModalProps) {
  const [formData, setFormData] = useState<CreatePlannedTransactionDTO>({
    amount: 0,
    type: 'EXPENSE',
    description: '',
    categoryId: '',
    plannedDate: new Date().toISOString().split('T')[0],
    notes: '',
  });

  const [alertConfig, setAlertConfig] = useState<AlertPopUp>({
    messaggio: '',
    tipo: '',
    checked: false,
  });

  // Inizializza form quando si apre in edit mode
  useEffect(() => {
    if (editingItem && isOpen) {
      setFormData({
        amount: Number(editingItem.amount),
        type: editingItem.type,
        description: editingItem.description,
        categoryId: editingItem.categoryId || '',
        plannedDate: editingItem.plannedDate.split('T')[0],
        notes: editingItem.notes || '',
      });
    } else if (!editingItem && isOpen) {
      // Reset form per nuovo item
      setFormData({
        amount: 0,
        type: 'EXPENSE',
        description: '',
        categoryId: '',
        plannedDate: new Date().toISOString().split('T')[0],
        notes: '',
      });
    }
  }, [editingItem, isOpen]);

  const filteredCategories = categories.filter((cat) => cat.type === formData.type);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingItem) {
        await plannedApi.update(editingItem.id, formData);
      } else {
        await plannedApi.create(formData);
      }

      setAlertConfig({
        messaggio: editingItem ? 'Spesa aggiornata con successo' : 'Spesa creata con successo',
        tipo: 'success',
        checked: true,
      });

      setTimeout(() => {
        onClose();
        onSuccess();
      }, 800);
    } catch (error: any) {
      setAlertConfig({
        messaggio: error.response?.data?.error || 'Errore nel salvataggio',
        tipo: 'error',
        checked: true,
      });
    }
  };

  if (!isOpen) return null;

  return (
    <BaseModal
      isOpen={isOpen}
      title={editingItem ? 'Modifica Spesa Pianificata' : 'Nuova Spesa Pianificata'}
      onClose={onClose}
      feedAlert={alertConfig}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
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

        <div className="form-group">
          <label className="form-label">Descrizione</label>
          <input
            type="text"
            value={formData.description}
            onChange={(e) =>
              setFormData({ ...formData, description: e.target.value })
            }
            className="form-input"
            required
            placeholder="Es. Meccanico, Dentista, Regalo..."
          />
        </div>

        <InputDecimal
          setFormData={setFormData}
          formData={formData}
          label={"Importo (€)"}
        />
           

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
          <label className="form-label">Data Prevista</label>
          <input
            type="date"
            value={formData.plannedDate}
            onChange={(e) =>
              setFormData({ ...formData, plannedDate: e.target.value })
            }
            className="form-input"
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label">Note (opzionali)</label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            className="form-textarea"
            rows={3}
            placeholder="Dettagli aggiuntivi..."
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
