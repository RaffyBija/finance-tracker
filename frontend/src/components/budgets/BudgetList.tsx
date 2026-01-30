import { Trash2, Pencil, AlertTriangle, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import type { Budget } from '../../types';
import EmptyState from '../shared/EmptyState';

interface BudgetListProps {
  budgets: Budget[];
  onEdit: (budget: Budget) => void;
  onDelete: (id: string) => void;
  onOpenModal: () => void;
}

/**
 * Lista completa dei budget con progress bars
 */
export default function BudgetList({
  budgets,
  onEdit,
  onDelete,
  onOpenModal,
}: BudgetListProps) {
  const getProgressColor = (percentage: number) => {
    if (percentage >= 100) return 'bg-danger-500';
    if (percentage >= 80) return 'bg-warning-500';
    if (percentage >= 60) return 'bg-warning-400';
    return 'bg-success-500';
  };

  const getStatusIcon = (percentage: number) => {
    if (percentage >= 100)
      return <AlertTriangle className="icon-md text-danger-500" />;
    if (percentage >= 80)
      return <AlertTriangle className="icon-md text-warning-500" />;
    return <CheckCircle className="icon-md text-success-500" />;
  };

  if (budgets.length === 0) {
    return (
      <EmptyState
        title="Nessun budget trovato"
        description="Crea il tuo primo budget per monitorare le spese"
        actionLabel="Crea Budget"
        onAction={onOpenModal}
      />
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {budgets.map((budget) => (
        <div key={budget.id} className="budget-card">
          <div className="budget-card-header">
            <div>
              <h3 className="budget-card-title">{budget.name}</h3>
              <p className="budget-card-subtitle">
                {budget.category?.name || 'Tutte le categorie'} • {budget.period}
              </p>
              <p className="text-xs text-neutral-400 mt-1">
                {format(new Date(budget.startDate), 'dd MMM yyyy', { locale: it })}
                {budget.endDate &&
                  ` - ${format(new Date(budget.endDate), 'dd MMM yyyy', {
                    locale: it,
                  })}`}
              </p>
            </div>
            <div className="flex gap-2">
              {getStatusIcon(budget.percentage || 0)}
              <button onClick={() => onEdit(budget)} className="btn-icon-primary">
                <Pencil className="icon-sm" />
              </button>
              <button onClick={() => onDelete(budget.id)} className="btn-icon-danger">
                <Trash2 className="icon-sm" />
              </button>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="budget-card-progress">
            <div className="flex-between text-sm mb-2">
              <span className="text-neutral-600">
                Speso: €{budget.spent?.toFixed(2) || 0}
              </span>
              <span className="font-semibold">
                {budget.percentage?.toFixed(1) || 0}%
              </span>
            </div>
            <div className="budget-card-progress-bar">
              <div
                className={`budget-card-progress-fill ${getProgressColor(
                  budget.percentage || 0
                )}`}
                style={{
                  width: `${Math.min(budget.percentage || 0, 100)}%`,
                }}
              />
            </div>
          </div>

          {/* Importi */}
          <div className="budget-card-stats">
            <div>
              <p className="text-xs text-neutral-500">Budget</p>
              <p className="text-lg font-bold text-neutral-900">
                €{Number(budget.amount).toFixed(2)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-neutral-500">Rimanente</p>
              <p
                className={`text-lg font-bold ${
                  (budget.remaining || 0) >= 0
                    ? 'text-success-600'
                    : 'text-danger-600'
                }`}
              >
                €{budget.remaining?.toFixed(2) || 0}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
