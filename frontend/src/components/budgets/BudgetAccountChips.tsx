import type { BudgetAccountsState } from '../../hooks/useBudgetAccounts';

// Chip dei conti BANK inclusi nel piano del periodo (stessa selezione del box e del modal).
export default function BudgetAccountChips({ accounts }: { accounts: BudgetAccountsState }) {
  const { bankAccounts, selectedIds, allSelected, toggle, selectAll } = accounts;
  return (
    <div>
      <div className="budget-sugg-accounts-head">
        <span className="form-label">Conti da includere</span>
        {!allSelected && (
          <button type="button" className="budget-sugg-selectall" onClick={selectAll}>
            Seleziona tutti
          </button>
        )}
      </div>
      <div className="budget-sugg-accounts">
        {bankAccounts.map((a) => {
          const checked = selectedIds.includes(a.id);
          return (
            <label key={a.id} className={`budget-sugg-account ${checked ? 'is-selected' : ''}`}>
              <input type="checkbox" checked={checked} onChange={() => toggle(a.id)} />
              {a.icon && (
                <span className="budget-sugg-account-icon" aria-hidden="true">
                  {a.icon}
                </span>
              )}
              <span className="budget-sugg-account-name">{a.name}</span>
            </label>
          );
        })}
      </div>
      <p className="form-help">
        Escludi un conto (es. risparmi): spariscono dal calcolo il suo saldo e i suoi flussi.
      </p>
    </div>
  );
}
