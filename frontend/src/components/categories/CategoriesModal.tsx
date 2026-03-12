import BaseModal from '../layout/ModalBase';
import type { CreateCategoryDTO, Category, AlertPopUp } from '../../types';
import { useState } from 'react';
import { useCreateCategory, useUpdateCategory } from '../../hooks/useCategories';

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

  // ✅ Usa i mutation hooks — invalidateQueries è già dentro onSuccess
  const createMutation = useCreateCategory();
  const updateMutation = useUpdateCategory();

  const [formData, setFormData] = useState<CreateCategoryDTO>({
    name: '',
    type: 'EXPENSE',
    color: COLORS[0],
    icon: ICONS[0],
  });

  const [alertConfig, setAlertConfig] = useState<AlertPopUp>({
    messaggio: '',
    tipo: '',
    checked: false,
  });

  if (editingCategory && formData.name === '') {
    setFormData({
      name: editingCategory.name,
      type: editingCategory.type,
      color: editingCategory.color,
      icon: editingCategory.icon,
    });
  }

  const isLoading = createMutation.isPending || updateMutation.isPending;

  const handleClose = () => {
    onClose();
    sentFeed();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let messaggio = '';

    try {
      if (editingCategory) {
        // Nessuna modifica apportata
        if (
          editingCategory.name === formData.name &&
          editingCategory.color === formData.color &&
          editingCategory.icon === formData.icon
        ) {
          setAlertConfig({ messaggio: 'Nessuna modifica apportata', tipo: 'info', checked: true });
          setTimeout(onClose, 800);
          return;
        }
        // ✅ Usa il mutation hook → invalida automaticamente la cache
        await updateMutation.mutateAsync({ id: editingCategory.id, data: formData });
        messaggio = 'Categoria aggiornata con successo';
      } else {
        // ✅ Usa il mutation hook → invalida automaticamente la cache
        await createMutation.mutateAsync(formData);
        messaggio = 'Categoria creata con successo';
      }

      setAlertConfig({ messaggio, tipo: 'success', checked: true });
      setTimeout(handleClose, 800);
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
      title={editingCategory ? 'Modifica Categoria' : 'Nuova Categoria'}
      onClose={onClose}
      feedAlert={alertConfig}
    >
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-2xl font-bold mb-4">
          {editingCategory ? 'Modifica Categoria' : 'Nuova Categoria'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Nome</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Tipo</label>
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, type: 'INCOME' })}
                className={`flex-1 py-2 rounded ${
                  formData.type === 'INCOME' ? 'bg-green-600 text-white' : 'bg-gray-100'
                }`}
                disabled={!!editingCategory}
              >
                Entrata
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, type: 'EXPENSE' })}
                className={`flex-1 py-2 rounded ${
                  formData.type === 'EXPENSE' ? 'bg-red-600 text-white' : 'bg-gray-100'
                }`}
                disabled={!!editingCategory}
              >
                Uscita
              </button>
            </div>
            {editingCategory && (
              <p className="text-xs text-gray-500 mt-1">Il tipo non può essere modificato</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Colore</label>
            <div className="grid grid-cols-5 gap-2">
              {COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setFormData({ ...formData, color })}
                  className={`w-10 h-10 rounded-full ${
                    formData.color === color ? 'ring-2 ring-offset-2 ring-blue-500' : ''
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Icona</label>
            <div className="grid grid-cols-5 gap-2">
              {ICONS.map((icon) => (
                <button
                  key={icon}
                  type="button"
                  onClick={() => setFormData({ ...formData, icon })}
                  className={`w-10 h-10 text-2xl rounded ${
                    formData.icon === icon ? 'bg-blue-100 ring-2 ring-blue-500' : 'bg-gray-100'
                  }`}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn btn-ghost btn-md flex-1">
              Annulla
            </button>
            <button type="submit" disabled={isLoading} className="btn btn-primary btn-md flex-1">
              {isLoading ? 'Salvataggio...' : editingCategory ? 'Aggiorna' : 'Crea'}
            </button>
          </div>
        </form>
      </div>
    </BaseModal>
  );
}