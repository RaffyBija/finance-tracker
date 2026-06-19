import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Target } from 'lucide-react';
import { useBudgets } from '../../../hooks/useBudgets';
import { useFormatCurrency } from '../../../hooks/useFormatCurrency';
import { SkeletonCard } from '../../shared/Skeleton';

const progressClass = (pct: number) => (pct >= 100 ? 'is-danger' : pct >= 80 ? 'is-warn' : 'is-ok');

// Widget "Budget" — progress dei budget attivi, i più a rischio in alto.
export default function BudgetOverviewWidget() {
  const navigate = useNavigate();
  const { budgets, isLoading } = useBudgets();
  const { formatCurrency } = useFormatCurrency();

  const sorted = useMemo(
    () => [...budgets].sort((a, b) => (b.percentage ?? 0) - (a.percentage ?? 0)).slice(0, 5),
    [budgets]
  );

  if (isLoading) return <SkeletonCard />;

  return (
    <div className="card budget-overview">
      <div className="widget-head">
        <h3 className="widget-title">Budget</h3>
      </div>
      {sorted.length === 0 ? (
        <div className="dashboard-empty-state">
          <Target size={20} className="budget-overview-empty-icon" />
          Nessun budget attivo
        </div>
      ) : (
        <div className="budget-overview-list">
          {sorted.map((budget) => {
            const pct = budget.percentage ?? 0;
            return (
              <button
                key={budget.id}
                type="button"
                className="budget-overview-row"
                onClick={() => navigate('/budgets')}
                aria-label={`Apri budget ${budget.name}`}
              >
                <div className="budget-overview-row-top">
                  <span className="budget-overview-name">{budget.name}</span>
                  <span className="budget-overview-figures">
                    {formatCurrency(budget.spent ?? 0)} / {formatCurrency(Number(budget.amount))}
                  </span>
                </div>
                <div className="budget-overview-bar-track">
                  <div
                    className={`budget-overview-bar-fill ${progressClass(pct)}`}
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
