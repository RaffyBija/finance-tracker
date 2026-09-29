import { useState, useEffect, useMemo } from 'react';
import BaseModal from '../layout/ModalBase';
import FormError from '../shared/FormError';
import FieldError from '../shared/FieldError';
import type { Category, CategoryNature, CreateCategoryDTO, TransactionType } from '../../types';
import { useCreateCategory, useUpdateCategory } from '../../hooks/useCategories';
import { useToast } from '../../contexts/ToastContext';
import { useFormValidation } from '../../hooks/useFormValidation';
import { buildCategoryTree } from '../../utils/categoryTree';

// Crea / modifica una categoria: nome, tipo (solo alla creazione), macro di
// appartenenza (nessuna = è una macro), natura (solo macro di uscita), colore e
// icona. Una sotto-categoria nuova eredita il colore della sua macro.

const COLORS = [
  '#EF4444', '#F97316', '#F59E0B', '#EAB308', '#84CC16', '#22C55E', '#10B981', '#14B8A6',
  '#0EA5E9', '#3B82F6', '#6366F1', '#8B5CF6', '#A855F7', '#EC4899', '#F43F5E', '#78716C', '#44403C',
];

const ICONS = [
  '💰', '💼', '⏱️', '📈', '🏷️', '↩️', '🎁',
  '🏠', '🔑', '🧾', '🏢', '🛠️', '🛋️', '💡',
  '🛒', '🥖', '🍽️', '☕', '🛵', '🍕',
  '🚗', '⛽', '🚌', '🔧', '🛡️', '🅿️', '🚕', '✈️',
  '🏥', '💊', '🩺', '❤️',
  '👕', '💇', '🏋️', '🛍️',
  '🎮', '📺', '🎟️', '🎨', '📚', '🎵',
  '📱', '🌐', '💻',
  '👪', '🧸', '🐶',
  '🏦', '🏛️', '💳',
  '🎓', '📦', '❓',
];

interface CategoryFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];            // tutte (per scegliere la macro)
  editingCategory: Category | null;
  defaultType?: TransactionType;
  defaultParentId?: string | null;   // "Aggiungi sotto-categoria"
}

type FormState = CreateCategoryDTO & { parentId: string | null; nature: CategoryNature | null };

export default function CategoryFormModal({
  isOpen, onClose, categories, editingCategory, defaultType = 'EXPENSE', defaultParentId = null,
}: CategoryFormModalProps) {
  const createMutation = useCreateCategory();
  const updateMutation = useUpdateCategory();
  const toast = useToast();

  const [formData, setFormData] = useState<FormState>({
    name: '', type: defaultType, color: COLORS[0], icon: ICONS[0], parentId: null, nature: null,
  });
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const parent = defaultParentId ? categories.find((c) => c.id === defaultParentId) : undefined;
    setFormData({
      name: editingCategory?.name ?? '',
      type: editingCategory?.type ?? parent?.type ?? defaultType,
      color: editingCategory?.color ?? parent?.color ?? COLORS[0],
      icon: editingCategory?.icon ?? ICONS[0],
      parentId: editingCategory ? editingCategory.parentId ?? null : defaultParentId,
      nature: editingCategory?.nature ?? null,
    });
    setSubmitError(null);
  }, [isOpen, editingCategory, defaultParentId, defaultType, categories]);

  // Macro possibili: stesso tipo, non di sistema, non la categoria stessa. Una
  // categoria con sotto-categorie non può finire sotto un'altra (2 livelli).
  const hasChildren = !!editingCategory && categories.some((c) => c.parentId === editingCategory.id);
  const macroOptions = useMemo(
    () => buildCategoryTree(categories, formData.type)
      .map((n) => n.category)
      .filter((c) => !c.isSystem && !c.archivedAt && c.id !== editingCategory?.id),
    [categories, formData.type, editingCategory],
  );

  const isPending = createMutation.isPending || updateMutation.isPending;
  const isMacro = !formData.parentId;

  const { errors, validate, clearError } = useFormValidation<FormState>({
    name: (value) => {
      if (!value?.trim()) return 'Il nome è obbligatorio';
      if (value.trim().length < 2) return 'Il nome deve avere almeno 2 caratteri';
      if (value.trim().length > 30) return 'Il nome è troppo lungo (max 30 caratteri)';
      return null;
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    if (!validate(formData)) return;
    const payload = {
      name: formData.name,
      type: formData.type,
      color: formData.color,
      icon: formData.icon,
      parentId: formData.parentId,
      nature: isMacro && formData.type === 'EXPENSE' ? formData.nature : null,
    };
    try {
      if (editingCategory) {
        const { type: _t, ...data } = payload;
        await updateMutation.mutateAsync({ id: editingCategory.id, data });
        toast.success('Categoria aggiornata');
      } else {
        await createMutation.mutateAsync(payload);
        toast.success('Categoria creata');
      }
      onClose();
    } catch (error: any) {
      setSubmitError(error.response?.data?.error || 'Errore nel salvataggio. Riprova.');
    }
  };

  if (!isOpen) return null;

  return (
    <BaseModal
      isOpen={isOpen}
      title={editingCategory ? 'Modifica categoria' : formData.parentId ? 'Nuova sotto-categoria' : 'Nuova categoria'}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="modal-form">
        <FormError message={submitError} />
        <div className="form-group">
          <label className="form-label form-label-required" htmlFor="cat-name">Nome</label>
          <input
            id="cat-name"
            type="text"
            value={formData.name}
            onChange={(e) => { setFormData({ ...formData, name: e.target.value }); clearError('name'); }}
            className="form-input"
          />
          <FieldError message={errors.name} />
        </div>

        {!editingCategory && (
          <div className="form-group">
            <span className="form-label">Tipo</span>
            <div className="form-button-group">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, type: 'INCOME', parentId: null, nature: null })}
                className={`btn-toggle ${formData.type === 'INCOME' ? 'btn-toggle-income-active' : 'btn-toggle-inactive'}`}
              >
                Entrata
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, type: 'EXPENSE', parentId: null })}
                className={`btn-toggle ${formData.type === 'EXPENSE' ? 'btn-toggle-expense-active' : 'btn-toggle-inactive'}`}
              >
                Uscita
              </button>
            </div>
          </div>
        )}

        <div className="form-group">
          <label className="form-label" htmlFor="cat-parent">Macro-categoria</label>
          <select
            id="cat-parent"
            className="form-select"
            value={formData.parentId ?? ''}
            disabled={hasChildren}
            onChange={(e) => {
              const parentId = e.target.value || null;
              const parent = parentId ? categories.find((c) => c.id === parentId) : undefined;
              setFormData({ ...formData, parentId, color: !editingCategory && parent?.color ? parent.color : formData.color });
            }}
          >
            <option value="">Nessuna: è una macro-categoria</option>
            {macroOptions.map((c) => (
              <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
            ))}
          </select>
          <p className="form-help">
            {hasChildren
              ? 'Questa categoria contiene delle sotto-categorie: resta una macro.'
              : 'Le macro raggruppano categorie simili: Analisi e budget possono ragionare per macro.'}
          </p>
        </div>

        {isMacro && formData.type === 'EXPENSE' && (
          <div className="form-group">
            <span className="form-label">Natura della spesa</span>
            <div className="form-button-group" role="group" aria-label="Natura della spesa">
              {([['ESSENTIAL', 'Essenziale'], ['DISCRETIONARY', 'Discrezionale'], [null, 'Non indicata']] as const).map(([value, label]) => (
                <button
                  key={label}
                  type="button"
                  aria-pressed={formData.nature === value}
                  onClick={() => setFormData({ ...formData, nature: value })}
                  className={`btn-toggle ${formData.nature === value ? 'btn-toggle-neutral-active' : 'btn-toggle-inactive'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="form-help">
              Essenziale: casa, spesa, salute. Discrezionale: svago, ristoranti. Le proposte di budget tagliano solo il discrezionale.
            </p>
          </div>
        )}

        <div className="form-group">
          <span className="form-label">Colore</span>
          <div className="color-swatch-grid">
            {COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => setFormData({ ...formData, color })}
                className={`color-swatch${formData.color === color ? ' is-selected' : ''}`}
                style={{ backgroundColor: color }}
                aria-label={`Colore ${color}`}
                aria-pressed={formData.color === color}
              />
            ))}
          </div>
        </div>

        <div className="form-group">
          <span className="form-label">Icona</span>
          <div className="icon-swatch-grid">
            {ICONS.map((icon) => (
              <button
                key={icon}
                type="button"
                onClick={() => setFormData({ ...formData, icon })}
                className={`icon-swatch${formData.icon === icon ? ' is-selected' : ''}`}
                aria-pressed={formData.icon === icon}
              >
                {icon}
              </button>
            ))}
          </div>
        </div>

        <div className="form-actions">
          <button type="button" onClick={onClose} className="btn btn-ghost btn-md btn-cancel">Annulla</button>
          <button type="submit" disabled={isPending} className="btn btn-primary btn-md">
            {isPending ? 'Salvataggio...' : editingCategory ? 'Aggiorna' : 'Crea'}
          </button>
        </div>
      </form>
    </BaseModal>
  );
}
