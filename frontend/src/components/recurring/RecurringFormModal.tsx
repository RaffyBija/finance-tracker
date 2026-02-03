import { useState, useEffect } from 'react';
import BaseModal from '../layout/ModalBase';
import { InputDecimal } from '../layout/InputNumberDecimal';
import type {
  RecurringTransaction,
  Category,
  CreateRecurringTransactionDTO,
  Frequency,
  AlertPopUp,
} from '../../types';
import { recurringApi } from '../../api/recurring';

interface RecurringFormModalProps {
  isOpen: boolean;
  editingItem: RecurringTransaction | null;
  categories: Category[];
  onClose: () => void;
  onSuccess: () => void;
}

/**
 * Modal form per creare/modificare transazioni ricorrenti
 * Usa BaseModal come wrapper riutilizzabile
 */
export default function RecurringFormModal({
  isOpen,
  editingItem,
  categories,
  onClose,
  onSuccess,
}: RecurringFormModalProps) {
  const [formData, setFormData] = useState<CreateRecurringTransactionDTO>({
    amount: 0,
    type: 'EXPENSE',
    description: '',
    categoryId: '',
    frequency: 'MONTHLY',
    dayOfMonth: 1,
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
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
        frequency: editingItem.frequency,
        dayOfMonth: editingItem.dayOfMonth || 1,
        startDate: editingItem.startDate.split('T')[0],
        endDate: editingItem.endDate ? editingItem.endDate.split('T')[0] : '',
      });
    } else if (!editingItem && isOpen) {
      // Reset form per nuovo item
      setFormData({
        amount: 0,
        type: 'EXPENSE',
        description: '',
        categoryId: '',
        frequency: 'MONTHLY',
        dayOfMonth: 1,
        startDate: new Date().toISOString().split('T')[0],
        endDate: '',
      });
    }
  }, [editingItem, isOpen]);

  const filteredCategories = categories.filter((cat) => cat.type === formData.type);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingItem) {
        await recurringApi.update(editingItem.id, formData);
      } else {
        await recurringApi.create(formData);
      }

      setAlertConfig({
        messaggio: editingItem
          ? 'Spesa ricorrente aggiornata con successo'
          : 'Spesa ricorrente creata con successo',
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
      title={editingItem ? 'Modifica Spesa Ricorrente' : 'Nuova Spesa Ricorrente'}
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
            placeholder="Es. Affitto, Stipendio, Bolletta..."
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
          <label className="form-label">Frequenza</label>
          <select
            value={formData.frequency}
            onChange={(e) =>
              setFormData({
                ...formData,
                frequency: e.target.value as Frequency,
              })
            }
            className="form-select"
            required
          >
            <option value="WEEKLY">Settimanale</option>
            <option value="MONTHLY">Mensile</option>
            <option value="YEARLY">Annuale</option>
          </select>
        </div>

        {formData.frequency === 'MONTHLY' && (
          <div className="form-group">
            <label className="form-label">Giorno del Mese (1-31)</label>
            <input
              type="number"
              min="1"
              max="31"
              value={formData.dayOfMonth}
              onChange={(e) =>
                setFormData({ ...formData, dayOfMonth: parseInt(e.target.value) })
              }
              className="form-input"
              required
            />
          </div>
        )}

        <div className="form-group">
          <label className="form-label">Data Inizio</label>
          <input
            type="date"
            value={formData.startDate}
            onChange={(e) =>
              setFormData({ ...formData, startDate: e.target.value })
            }
            className="form-input"
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label">Data Fine (opzionale)</label>
          <input
            type="date"
            value={formData.endDate}
            onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
            className="form-input"
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
