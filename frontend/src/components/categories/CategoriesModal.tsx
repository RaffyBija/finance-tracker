import BaseModal from '../layout/ModalBase';
import type { CreateCategoryDTO, Category } from '../../types';
import { useState } from 'react';
import { useCreateCategory, useUpdateCategory } from '../../hooks/useCategories';
import { useToast } from '../../contexts/ToastContext';
import { useFormValidation } from '../../hooks/useFormValidation';
import FieldError from '../shared/FieldError'

const COLORS = [
  '#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#6366F1', '#8B5CF6',
  '#EC4899', '#14B8A6', '#F97316', '#84CC16',
];

const ICONS = ['💰', '🏠', '🍔', '🚗', '🎮', '💼', '🏥', '🎓', '✈️', '🛒'];

interface CategoriesModalProps {
  isOpen: boolean;
  editingCategory: Category | null;
  onClose: () => void;
  sentFeed: () => void;
}

export default function CategoriesModal({
  isOpen,
  onClose,
  sentFeed,
  editingCategory,
}: CategoriesModalProps) {
  if (!isOpen) return null;

  const createMutation = useCreateCategory();
  const updateMutation = useUpdateCategory();
  const toast = useToast();

  const [formData, setFormData] = useState<CreateCategoryDTO>({
    name: editingCategory?.name ?? '',
    type: editingCategory?.type ?? 'EXPENSE',
    color: editingCategory?.color ?? COLORS[0],
    icon: editingCategory?.icon ?? ICONS[0],
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  const { errors, validate, clearError } = useFormValidation<CreateCategoryDTO>({
  name: (value) => {
    if (!value?.trim()) return 'Il nome è obbligatorio';
    if (value.trim().length < 2) return 'Il nome deve avere almeno 2 caratteri';
    if (value.trim().length > 30) return 'Il nome è troppo lungo (max 30 caratteri)';
    return null;
  },
});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!validate(formData)) return;

    try {
      if (editingCategory) {
        const unchanged =
          editingCategory.name === formData.name &&
          editingCategory.color === formData.color &&
          editingCategory.icon === formData.icon;

        if (unchanged) {
          toast.info('Nessuna modifica apportata');
          onClose();
          return;
        }
        await updateMutation.mutateAsync({ id: editingCategory.id, data: formData });
        toast.success('Categoria aggiornata con successo');
      } else {
        await createMutation.mutateAsync(formData);
        toast.success('Categoria creata con successo');
      }

      onClose();
      sentFeed();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Errore nel salvataggio');
    }
  };

  return (
    <BaseModal
      isOpen={isOpen}
      title={editingCategory ? 'Modifica Categoria' : 'Nuova Categoria'}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="form-group">
          <label className="form-label">Nome</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => {
              setFormData({ ...formData, name: e.target.value })
              clearError('name');
            }}
            className="form-input"
          />
          <FieldError message={errors.name} />
        </div>

        {!editingCategory && (
          <div className="form-group">
            <label className="form-label">Tipo</label>
            <div className="form-button-group">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, type: 'INCOME' })}
                className={`btn-toggle flex-1 ${
                  formData.type === 'INCOME' ? 'btn-toggle-income-active' : 'btn-toggle-inactive'
                }`}
              >
                Entrata
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, type: 'EXPENSE' })}
                className={`btn-toggle flex-1 ${
                  formData.type === 'EXPENSE' ? 'btn-toggle-expense-active' : 'btn-toggle-inactive'
                }`}
              >
                Uscita
              </button>
            </div>
          </div>
        )}

        <div className="form-group">
          <label className="form-label">Colore</label>
          <div className="flex flex-wrap gap-2">
            {COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => setFormData({ ...formData, color })}
                className="w-8 h-8 rounded-full border-2 transition-transform hover:scale-110"
                style={{
                  backgroundColor: color,
                  borderColor: formData.color === color ? '#1e293b' : 'transparent',
                  transform: formData.color === color ? 'scale(1.15)' : undefined,
                }}
              />
            ))}
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Icona</label>
          <div className="flex flex-wrap gap-2">
            {ICONS.map((icon) => (
              <button
                key={icon}
                type="button"
                onClick={() => setFormData({ ...formData, icon })}
                className={`w-10 h-10 rounded-lg text-lg transition-all ${
                  formData.icon === icon
                    ? 'bg-primary-100 border-2 border-primary-400 scale-110'
                    : 'bg-neutral-100 border-2 border-transparent hover:bg-neutral-200'
                }`}
              >
                {icon}
              </button>
            ))}
          </div>
        </div>

        <div className="form-actions">
          <button type="button" onClick={onClose} className="btn btn-ghost btn-md">
            Annulla
          </button>
          <button type="submit" disabled={isPending} className="btn btn-primary btn-md">
            {isPending ? 'Salvataggio...' : editingCategory ? 'Aggiorna' : 'Crea'}
          </button>
        </div>
      </form>
    </BaseModal>
  );
}