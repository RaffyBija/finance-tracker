import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBudgets } from '../../../hooks/useBudgets';

const RISK_THRESHOLD = 80;

// Tessera KPI "Budget a rischio": quanti budget sono ≥80% / sforati, col peggiore
// in evidenza. Stato calmo (verde) quando è tutto sotto controllo.
export default function BudgetRiskTile() {
  const navigate = useNavigate();
  const { budgets } = useBudgets();

  const { atRisk, worst } = useMemo(() => {
    const risky = budgets
      .filter((b) => (b.percentage ?? 0) >= RISK_THRESHOLD)
      .sort((a, b) => (b.percentage ?? 0) - (a.percentage ?? 0));
    return { atRisk: risky.length, worst: risky[0] };
  }, [budgets]);

  if (budgets.length === 0) return null;

  if (atRisk === 0) {
    return (
      <button
        type="button"
        className="dashboard-tile dashboard-tile-budget is-ok"
        onClick={() => navigate('/budgets')}
        aria-label="Budget: tutti sotto controllo, apri budget"
      >
        <span className="dashboard-tile-label">Budget</span>
        <span className="dashboard-tile-figure-ok">Tutti sotto controllo</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      className="dashboard-tile dashboard-tile-budget is-danger"
      onClick={() => navigate('/budgets')}
      aria-label={`Budget a rischio: ${atRisk}, peggiore ${worst?.name}, apri budget`}
    >
      <span className="dashboard-tile-label">Budget a rischio</span>
      <span className="dashboard-tile-figure is-expense">
        {atRisk} su {budgets.length}
      </span>
      {worst && (
        <span className="dashboard-tile-meta">
          {worst.name} {Math.round(worst.percentage ?? 0)}%
        </span>
      )}
    </button>
  );
}
