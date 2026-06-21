import { AlertTriangle, CheckCircle } from 'lucide-react';
import type { Budget } from '../../types';
import EmptyState from '../shared/EmptyState';
import { useFormatCurrency } from '../../hooks/useFormatCurrency';

interface BudgetListProps {
  budgets: Budget[];
  onOpenModal: () => void;
  onCardClick: (budget: Budget) => void;
}

// Testo "si azzera tra…" calcolato dalla fine della finestra del periodo corrente.
function resetHint(periodEnd?: string): string | null {
  if (!periodEnd) return null;
  const end = new Date(periodEnd);
  const now = new Date();
  const msPerDay = 24 * 60 * 60 * 1000;
  const days = Math.ceil((end.getTime() - now.getTime()) / msPerDay);
  if (days <= 0) return 'si azzera oggi';
  if (days === 1) return 'si azzera domani';
  return `si azzera tra ${days} giorni`;
}

// Tono dello stato in base alla percentuale di utilizzo.
function statusTone(pct: number): 'ok' | 'warn' | 'over' {
  if (pct >= 100) return 'over';
  if (pct >= 80) return 'warn';
  return 'ok';
}

/**
 * Overview dei budget: una card per budget sul periodo CORRENTE. La cifra spesa
 * è l'elemento più forte; la card è cliccabile e apre il dettaglio con lo storico.
 * Edit/Delete restano icon-button che fermano la propagazione.
 */
export default function BudgetList({
  budgets,
  onOpenModal,
  onCardClick,
}: BudgetListProps) {
  const { formatCurrency } = useFormatCurrency();

  if (budgets.length === 0) {
    return (
      <EmptyState
        title="Nessun budget"
        description="Crea un budget per tenere d'occhio una spesa discrezionale: si azzera da solo a ogni periodo e ne conservi lo storico."
        actionLabel="Crea budget"
        onAction={onOpenModal}
      />
    );
  }

  return (
    <div className="card-grid-2">
        {budgets.map((budget) => {
          const pct = budget.percentage || 0;
          const tone = statusTone(pct);
          const remaining = budget.remaining ?? 0;
          const hint = resetHint(budget.periodEnd);
          // Budget effettivo del periodo corrente (= base + riporto). Fallback alla base.
          const effective = budget.effectiveAmount ?? Number(budget.amount);
          const carry = budget.carryIn ?? 0;
          const showCarry = budget.rollover !== 'NONE' && Math.abs(carry) >= 0.005;

          return (
            <div
              key={budget.id}
              className="budget-card budget-card-clickable"
              role="button"
              tabIndex={0}
              onClick={() => onCardClick(budget)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onCardClick(budget);
                }
              }}
            >
              <div className="budget-card-header">
                <div className="budget-card-heading">
                  <h3 className="budget-card-title">{budget.name}</h3>
                  <p className="budget-card-subtitle">
                    {budget.category?.name || 'Tutte le categorie'}
                  </p>
                </div>
                <div className="budget-card-actions">
                  {tone === 'over' ? (
                    <AlertTriangle className="icon-md text-danger-500" aria-label="Budget superato" />
                  ) : tone === 'warn' ? (
                    <AlertTriangle className="icon-md text-warning-500" aria-label="Vicino al limite" />
                  ) : (
                    <CheckCircle className="icon-md text-success-500" aria-label="Entro il budget" />
                  )}
                </div>
              </div>

              {/* La cifra spesa è l'eroe della card */}
              <div className="budget-card-figure">
                <span className="budget-card-spent">{formatCurrency(budget.spent ?? 0)}</span>
                <span className="budget-card-of">
                  {effective > 0 ? `di ${formatCurrency(effective)}` : 'budget esaurito'}
                </span>
                <span className={`budget-card-pct is-${tone}`}>{pct.toFixed(0)}%</span>
              </div>

              {showCarry && (
                <p
                  className={`budget-card-carry ${
                    carry >= 0 ? 'is-positive' : 'is-negative'
                  }`}
                >
                  {carry >= 0
                    ? `+${formatCurrency(carry)} dal periodo scorso`
                    : `−${formatCurrency(Math.abs(carry))} dal periodo scorso`}
                </p>
              )}

              <div className="budget-card-progress-bar">
                <div
                  className={`budget-card-progress-fill is-${tone}`}
                  style={{ width: `${Math.min(pct, 100)}%` }}
                />
              </div>

              <div className="budget-card-meta">
                <span
                  className={`budget-card-remaining ${
                    remaining >= 0 ? 'is-positive' : 'is-negative'
                  }`}
                >
                  {remaining >= 0
                    ? `${formatCurrency(remaining)} rimasti`
                    : `${formatCurrency(Math.abs(remaining))} oltre il budget`}
                </span>
                <span className="budget-card-period">
                  {budget.periodLabel}
                  {hint && ` · ${hint}`}
                </span>
              </div>
            </div>
          );
        })}
    </div>
  );
}
