import type { Budget } from '../../types';
import { useBudgetSuggestions } from '../../hooks/useBudgets';
import { useFormatCurrency } from '../../hooks/useFormatCurrency';

interface BudgetSummaryProps {
  budgets: Budget[];
}

// Budget attivo nel periodo corrente (startDate ≤ oggi e non ancora scaduto): solo
// questi concorrono agli aggregati, coerentemente con le card mostrate sotto.
function isActiveNow(b: Budget): boolean {
  const now = Date.now();
  const start = new Date(b.startDate).getTime();
  if (start > now) return false;
  if (b.endDate && new Date(b.endDate).getTime() < now) return false;
  return true;
}

// Fascia riepilogo in cima alla pagina Budget: dà il colpo d'occhio che mancava
// (budgetato/speso/rimanente dei budget attivi) + lo spendibile del mese, il numero
// d'orientamento immediato. Lo spendibile riusa l'endpoint dei suggerimenti (cacheato).
export default function BudgetSummary({ budgets }: BudgetSummaryProps) {
  const { formatCurrency } = useFormatCurrency();
  const { data: suggestions, isLoading: spendableLoading } = useBudgetSuggestions(
    undefined,
    true,
  );

  const active = budgets.filter(isActiveNow);

  // Budgetato = somma dei budget EFFETTIVI del periodo (base + eventuale riporto).
  const budgeted = active.reduce(
    (sum, b) => sum + (b.effectiveAmount ?? Number(b.amount)),
    0,
  );
  const spent = active.reduce((sum, b) => sum + (b.spent ?? 0), 0);
  const remaining = budgeted - spent;

  if (active.length === 0) return null;

  return (
    <div className="budget-summary">
      <div className="budget-summary-stat">
        <span className="budget-summary-label">Budgetato</span>
        <span className="budget-summary-value">{formatCurrency(budgeted)}</span>
      </div>
      <div className="budget-summary-stat">
        <span className="budget-summary-label">Speso</span>
        <span className="budget-summary-value">{formatCurrency(spent)}</span>
      </div>
      <div className="budget-summary-stat">
        <span className="budget-summary-label">Rimanente</span>
        <span
          className={`budget-summary-value ${
            remaining >= 0 ? 'is-positive' : 'is-negative'
          }`}
        >
          {formatCurrency(remaining)}
        </span>
      </div>
      <div className="budget-summary-stat budget-summary-spendable">
        <span className="budget-summary-label">Spendibile questo mese</span>
        <span className="budget-summary-value">
          {spendableLoading || !suggestions ? '—' : formatCurrency(suggestions.spendable)}
        </span>
      </div>
    </div>
  );
}
