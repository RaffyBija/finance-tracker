import { useEffect, useState } from 'react';
import BaseModal from '../layout/ModalBase';
import FormError from '../shared/FormError';
import CategorySelect from './CategorySelect';
import type { Category } from '../../types';
import { useCategoryUsage, useDeleteCategory, useArchiveCategory } from '../../hooks/useCategories';
import { useToast } from '../../contexts/ToastContext';
import { apiError } from '../../utils/apiError';

// Elimina o unisci una categoria. Se è in uso non si lascia nulla di orfano:
// movimenti, righe divise, ricorrenti, pianificate, piani, budget, sotto-categorie
// e categoria stipendio passano alla categoria scelta. In alternativa si archivia.

interface Props {
  category: Category | null;
  categories: Category[];
  mode: 'delete' | 'merge';
  onClose: () => void;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export default function CategoryDeleteModal({ category, categories, mode, onClose }: Props) {
  const { data: usage, isLoading } = useCategoryUsage(category?.id ?? null);
  const deleteMutation = useDeleteCategory();
  const archiveMutation = useArchiveCategory();
  const toast = useToast();
  const [targetId, setTargetId] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setTargetId(''); setError(null); }, [category, mode]);

  if (!category) return null;

  const targets = categories.filter((c) =>
    c.type === category.type && c.id !== category.id && c.parentId !== category.id && !c.isSystem && !c.archivedAt);
  const items = usage ? [
    usage.transactions && plural(usage.transactions, 'transazione', 'transazioni'),
    usage.splitLines && plural(usage.splitLines, 'riga di transazioni divise', 'righe di transazioni divise'),
    usage.recurring && plural(usage.recurring, 'ricorrente', 'ricorrenti'),
    usage.planned && plural(usage.planned, 'pianificata', 'pianificate'),
    usage.plans && plural(usage.plans, 'piano a rate', 'piani a rate'),
    usage.budgets && plural(usage.budgets, 'budget', 'budget'),
    usage.children && plural(usage.children, 'sotto-categoria', 'sotto-categorie'),
    usage.salary && 'è la categoria dello stipendio',
  ].filter(Boolean) as string[] : [];
  const inUse = items.length > 0;
  const needsTarget = mode === 'merge' || inUse;

  const submit = async () => {
    setError(null);
    if (needsTarget && !targetId) { setError('Scegli la categoria di destinazione'); return; }
    try {
      const res = await deleteMutation.mutateAsync({ id: category.id, targetId: needsTarget ? targetId : undefined });
      toast.success(mode === 'merge' ? 'Categorie unite' : res.message);
      onClose();
    } catch (e) {
      setError(apiError(e, 'Operazione non riuscita'));
    }
  };

  const archive = async () => {
    try {
      const res = await archiveMutation.mutateAsync({ id: category.id });
      toast.success(res.message);
      onClose();
    } catch (e) {
      setError(apiError(e, 'Operazione non riuscita'));
    }
  };

  const title = mode === 'merge' ? `Unisci "${category.name}"` : `Elimina "${category.name}"`;

  return (
    <BaseModal isOpen={!!category} title={title} onClose={onClose}>
      <div className="modal-form">
        <FormError message={error} />
        {isLoading ? (
          <p className="form-help">Controllo dove è usata…</p>
        ) : (
          <>
            {inUse ? (
              <div className="category-usage">
                <span className="category-usage-title">Usata da</span>
                <ul className="category-usage-list">
                  {items.map((t) => <li key={t}>{t}</li>)}
                </ul>
              </div>
            ) : (
              <p className="form-help">Questa categoria non è usata da nessun movimento.</p>
            )}

            {needsTarget && (
              <div className="form-group">
                <label className="form-label form-label-required">
                  {mode === 'merge' ? 'Unisci in' : 'Sposta tutto in'}
                </label>
                <CategorySelect
                  categories={targets}
                  type={category.type}
                  value={targetId}
                  onChange={setTargetId}
                  placeholder="Scegli una categoria"
                  ariaLabel="Categoria di destinazione"
                />
                <p className="form-help">
                  Tutto ciò che usa "{category.name}" passa alla categoria scelta, poi "{category.name}" viene eliminata.
                  Se la destinazione ha già un budget, quello di "{category.name}" viene rimosso.
                </p>
              </div>
            )}

            {mode === 'delete' && inUse && (
              <p className="form-help">
                Vuoi solo toglierla dalle scelte senza toccare lo storico? Archiviala.
              </p>
            )}

            <div className="form-actions">
              <button type="button" onClick={onClose} className="btn btn-ghost btn-md btn-cancel">Annulla</button>
              {mode === 'delete' && inUse && (
                <button type="button" onClick={archive} disabled={archiveMutation.isPending} className="btn btn-secondary btn-md">
                  Archivia
                </button>
              )}
              <button
                type="button"
                onClick={submit}
                disabled={deleteMutation.isPending}
                className={mode === 'merge' ? 'btn btn-primary btn-md' : 'btn btn-danger btn-md'}
              >
                {mode === 'merge' ? 'Unisci' : inUse ? 'Sposta ed elimina' : 'Elimina'}
              </button>
            </div>
          </>
        )}
      </div>
    </BaseModal>
  );
}
