import { useEffect, useState } from 'react';
import BaseModal from '../layout/ModalBase';
import FormError from '../shared/FormError';
import { useOrganizePreview, useApplyOrganize } from '../../hooks/useCategories';
import { useToast } from '../../contexts/ToastContext';
import type { TransactionType } from '../../types';

// "Organizza categorie": per chi ha categorie senza macro (o creata prima dei
// predefiniti). L'app propone dove collocare ciascuna (per nome e parole chiave);
// l'utente conferma o corregge, e può aggiungere le categorie predefinite mancanti.

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const TYPE_LABEL: Record<TransactionType, string> = { EXPENSE: 'Uscite', INCOME: 'Entrate' };

export default function OrganizeCategoriesModal({ isOpen, onClose }: Props) {
  const { data, isLoading } = useOrganizePreview(isOpen);
  const applyMutation = useApplyOrganize();
  const toast = useToast();
  const [assign, setAssign] = useState<Record<string, string>>({});
  const [addDefaults, setAddDefaults] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!data) return;
    const init: Record<string, string> = {};
    for (const c of data.categories) init[c.id] = c.suggestion.macroKey ?? '';
    setAssign(init);
    setAddDefaults(data.missingDefaults > 0);
  }, [data]);

  if (!isOpen) return null;

  const apply = async () => {
    setError(null);
    try {
      await applyMutation.mutateAsync({
        assignments: Object.entries(assign).map(([categoryId, macroKey]) => ({ categoryId, macroKey: macroKey || null })),
        addDefaults,
      });
      toast.success('Categorie organizzate');
      onClose();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Operazione non riuscita');
    }
  };

  const groups: TransactionType[] = ['EXPENSE', 'INCOME'];

  return (
    <BaseModal isOpen={isOpen} title="Organizza categorie" onClose={onClose}>
      <div className="modal-form">
        <FormError message={error} />
        {isLoading || !data ? (
          <p className="form-help">Analizzo le tue categorie…</p>
        ) : (
          <>
            <p className="form-help">
              Raggruppa le tue categorie sotto le macro-categorie predefinite. Ho già proposto una collocazione in base al nome: correggila se serve. Nessun movimento viene toccato.
            </p>

            {data.categories.length === 0 ? (
              <p className="form-help">Tutte le tue categorie sono già organizzate.</p>
            ) : (
              groups.map((type) => {
                const rows = data.categories.filter((c) => c.type === type);
                if (rows.length === 0) return null;
                const macros = data.macros.filter((m) => m.type === type);
                return (
                  <div key={type} className="organize-group">
                    <span className="organize-group-title">{TYPE_LABEL[type]}</span>
                    <ul className="organize-list">
                      {rows.map((c) => (
                        <li key={c.id} className="organize-row">
                          <span className="organize-name">
                            <span className="organize-icon">{c.icon || '•'}</span>
                            {c.name}
                          </span>
                          <select
                            className="form-select organize-select"
                            value={assign[c.id] ?? ''}
                            onChange={(e) => setAssign((a) => ({ ...a, [c.id]: e.target.value }))}
                            aria-label={`Macro-categoria per ${c.name}`}
                            disabled={c.hasChildren}
                          >
                            <option value="">Resta macro personale</option>
                            {macros.map((m) => (
                              <option key={m.key} value={m.key}>
                                {m.icon} {m.name.toLowerCase() === c.name.toLowerCase() ? `${m.name} (diventa la macro)` : m.name}
                              </option>
                            ))}
                          </select>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })
            )}

            {data.missingDefaults > 0 && (
              <label className="form-checkbox-row">
                <input type="checkbox" checked={addDefaults} onChange={(e) => setAddDefaults(e.target.checked)} />
                Aggiungi le categorie predefinite mancanti ({data.missingDefaults})
              </label>
            )}

            <div className="form-actions">
              <button type="button" onClick={onClose} className="btn btn-ghost btn-md btn-cancel">Annulla</button>
              <button
                type="button"
                onClick={apply}
                disabled={applyMutation.isPending || (data.categories.length === 0 && !addDefaults)}
                className="btn btn-primary btn-md"
              >
                {applyMutation.isPending ? 'Organizzo…' : 'Applica'}
              </button>
            </div>
          </>
        )}
      </div>
    </BaseModal>
  );
}
