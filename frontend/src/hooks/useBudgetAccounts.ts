import { useCallback, useMemo, useState } from 'react';
import { useAccounts } from './useAccounts';

const STORAGE_KEY = 'budgetAccountIds';

function readStored(): string[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : null;
  } catch {
    return null;
  }
}

function writeStored(ids: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    /* storage non disponibile: la scelta vale solo per la sessione */
  }
}

/**
 * Selezione dei conti BANK inclusi nel piano del periodo, condivisa tra il box della
 * pagina Budget e il modal delle proposte (stessa istanza passata come prop).
 * Persistita in localStorage; default = tutti i conti BANK.
 */
export function useBudgetAccounts() {
  const { data: accounts = [] } = useAccounts();
  const bankAccounts = useMemo(() => accounts.filter((a) => a.type === 'BANK'), [accounts]);
  const [stored, setStored] = useState<string[] | null>(readStored);

  // Scarta id non più esistenti (conti archiviati/eliminati); vuoto => tutti i conti
  // (i budget contano la spesa di tutti i conti: il piano deve guardare lo stesso perimetro).
  const selectedIds = useMemo(() => {
    const valid = (stored ?? []).filter((id) => bankAccounts.some((a) => a.id === id));
    return valid.length > 0 ? valid : bankAccounts.map((a) => a.id);
  }, [stored, bankAccounts]);

  const update = useCallback((ids: string[]) => {
    setStored(ids);
    writeStored(ids);
  }, []);

  const toggle = useCallback(
    (id: string) => {
      if (selectedIds.includes(id)) {
        // Almeno un conto incluso: niente ambiguità [] / "nessun filtro" a valle.
        if (selectedIds.length <= 1) return;
        update(selectedIds.filter((x) => x !== id));
      } else {
        update([...selectedIds, id]);
      }
    },
    [selectedIds, update],
  );

  const selectAll = useCallback(() => update(bankAccounts.map((a) => a.id)), [bankAccounts, update]);

  const allSelected = bankAccounts.length > 0 && selectedIds.length === bankAccounts.length;
  // Tutti i BANK selezionati => nessun filtro (cache stabile); sottoinsieme => lista al backend.
  const accountIdsParam = useMemo(
    () => (allSelected || selectedIds.length === 0 ? undefined : selectedIds),
    [allSelected, selectedIds],
  );
  const selectedNames = useMemo(
    () => bankAccounts.filter((a) => selectedIds.includes(a.id)).map((a) => a.name),
    [bankAccounts, selectedIds],
  );

  return { bankAccounts, selectedIds, selectedNames, allSelected, accountIdsParam, toggle, selectAll };
}

export type BudgetAccountsState = ReturnType<typeof useBudgetAccounts>;
