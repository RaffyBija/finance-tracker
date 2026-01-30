import { useState, useEffect } from 'react';
import BaseModal from '../layout/ModalBase';
import type { Budget, Category, CreateBudgetDTO, BudgetPeriod, AlertPopUp } from '../../types';
import { budgetApi } from '../../api/budgets';

interface BudgetFormModalProps {
  isOpen: boolean;
  editingItem: Budget | null;
  categories: Category[];
  onClose: () => void;
  onSuccess: () => void;
}

/**
 * Modal form per creare/modificare budget
 * Usa BaseModal come wrapper riutilizzabile
 */
export default function BudgetFormModal({
  isOpen,
  editingItem,
  categories,
  onClose,
  onSuccess,
}: BudgetFormModalProps) {
  const [formData, setFormData] = useState<CreateBudgetDTO>({
    name: '',
    amount: 0,
    categoryId: '',
    period: 'MONTHLY',
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
        name: editingItem.name,
        amount: Number(editingItem.amount),
        categoryId: editingItem.categoryId || '',
        period: editingItem.period,
        startDate: editingItem.startDate.split('T')[0],
        endDate: editingItem.endDate ? editingItem.endDate.split('T')[0] : '',
      });
    } else if (!editingItem && isOpen) {
      // Reset form per nuovo item
      setFormData({
        name: '',
        amount: 0,
        categoryId: '',
        period: 'MONTHLY',
        startDate: new Date().toISOString().split('T')[0],
        endDate: '',
      });
    }
  }, [editingItem, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingItem) {
        await budgetApi.update(editingItem.id, formData);
      } else {
        await budgetApi.create(formData);
      }

      setAlertConfig({
        messaggio: editingItem ? 'Budget aggiornato con successo' : 'Budget creato con successo',
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
      title={editingItem ? 'Modifica Budget' : 'Nuovo Budget'}
      onClose={onClose}
      feedAlert={alertConfig}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="form-group">
          <label className="form-label">Nome</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="form-input"
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label">Importo Budget (€)</label>
          <input
            type="number"
            step="0.01"
            value={formData.amount}
            onChange={(e) =>
              setFormData({ ...formData, amount: parseFloat(e.target.value) })
            }
            className="form-input"
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label">Categoria (opzionale)</label>
          <select
            value={formData.categoryId}
            onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
            className="form-select"
          >
            <option value="">Tutte le spese</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Periodo</label>
          <select
            value={formData.period}
            onChange={(e) =>
              setFormData({
                ...formData,
                period: e.target.value as BudgetPeriod,
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
