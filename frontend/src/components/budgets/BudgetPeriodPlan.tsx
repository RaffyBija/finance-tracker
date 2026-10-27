import { useMemo, useState } from 'react';
import type { Budget } from '../../types';
import { useBudgetSuggestions } from '../../hooks/useBudgets';
import { useFormatCurrency } from '../../hooks/useFormatCurrency';
import type { BudgetAccountsState } from '../../hooks/useBudgetAccounts';
import { daysLabel, effectiveAmount, isActiveBudget } from '../../utils/budget';
import BudgetAccountChips from './BudgetAccountChips';
import { SkeletonCard } from '../shared/Skeleton';

interface BudgetPeriodPlanProps {
  budgets: Budget[];
  accounts: BudgetAccountsState;
  payConfigured: boolean;
}

/**
 * Box "Piano del periodo": quanto puoi spendere nel periodo (di paga, o mese se non
 * impostato), quanto resta e quanto al giorno, a confronto con i tetti dei budget dello
 * STESSO periodo. I budget con periodo diverso e il budget globale restano fuori dalla
 * somma: compaiono solo nelle card.
 */
export default function BudgetPeriodPlan({ budgets, accounts, payConfigured }: BudgetPeriodPlanProps) {
  const { formatCurrency } = useFormatCurrency();
  const [editingAccounts, setEditingAccounts] = useState(false);

  const { data, isLoading, isError } = useBudgetSuggestions(undefined, accounts.selectedIds.length > 0, {
    period: payConfigured ? 'pay' : 'month',
    offset: 0,
    accountIds: accounts.accountIdsParam,
  });

  // Tetti dello stesso periodo del piano: solo budget attivi per categoria (il globale
  // è un tetto complessivo, sommarlo raddoppierebbe).
  const { capsTotal, capsCount } = useMemo(() => {
    const same = budgets.filter(
      (b) => isActiveBudget(b) && !!b.categoryId && !!data && b.period === data.budgetPeriod,
    );
    return { capsTotal: same.reduce((s, b) => s + effectiveAmount(b), 0), capsCount: same.length };
  }, [budgets, data]);

  if (isLoading) return <SkeletonCard />;
  if (isError || !data) return null;

  const remaining = data.remaining ?? data.spendable - data.variableSpent;
  const daysLeft = Math.max(1, data.daysLeft ?? data.window.days - data.window.elapsedDays);
  const perDay = data.perDay ?? Math.round(Math.max(0, remaining) / daysLeft);
  const unallocated = data.spendable - capsTotal;
  const over = capsCount > 0 && capsTotal > data.spendable + 0.005;
  const fill = data.spendable > 0 ? Math.min(100, (capsTotal / data.spendable) * 100) : capsTotal > 0 ? 100 : 0;
  const accountNames = data.includedAccounts?.map((a) => a.name) ?? accounts.selectedNames;

  return (
    <section className="budget-plan" aria-label="Piano del periodo">
      <header className="budget-plan-head">
        <div className="budget-plan-heading">
          <h2 className="budget-plan-title">Piano del periodo</h2>
          <p className="budget-plan-period">
            {data.window.label}
            {accountNames.length > 0 && ` · Conti: ${accountNames.join(', ')}`}
          </p>
        </div>
        {accounts.bankAccounts.length > 1 && (
          <button
            type="button"
            className="budget-plan-edit"
            aria-expanded={editingAccounts}
            onClick={() => setEditingAccounts((v) => !v)}
          >
            {editingAccounts ? 'Chiudi' : 'Cambia conti'}
          </button>
        )}
      </header>

      {editingAccounts && accounts.bankAccounts.length > 1 && <BudgetAccountChips accounts={accounts} />}

      <div className="budget-plan-stats">
        <div className="budget-plan-stat">
          <span className="budget-plan-label">Spendibile</span>
          <span className="budget-plan-value">{formatCurrency(data.spendable)}</span>
          <span className="budget-plan-note">nel periodo</span>
        </div>
        <div className="budget-plan-stat is-primary">
          <span className="budget-plan-label">Restano ora</span>
          <span className={`budget-plan-value ${remaining < 0 ? 'is-negative' : ''}`}>
            {formatCurrency(remaining)}
          </span>
          <span className="budget-plan-note">dopo le spese variabili</span>
        </div>
        <div className="budget-plan-stat">
          <span className="budget-plan-label">Al giorno</span>
          <span className="budget-plan-value">{formatCurrency(perDay)}</span>
          <span className="budget-plan-note">per {daysLabel(daysLeft)}</span>
        </div>
      </div>

      {capsCount > 0 && (
        <div className="budget-plan-alloc">
          <div className="budget-plan-alloc-row">
            <span>
              Tetti dei budget ({capsCount}): <strong>{formatCurrency(capsTotal)}</strong>
            </span>
            {over ? (
              <span className="badge badge-sm badge-warning">
                Hai budgetato più dello spendibile
              </span>
            ) : (
              <span className="budget-plan-unallocated">Non allocato {formatCurrency(unallocated)}</span>
            )}
          </div>
          <div className="budget-plan-bar" aria-hidden="true">
            <div className={`budget-plan-bar-fill ${over ? 'is-over' : ''}`} style={{ width: `${fill}%` }} />
          </div>
          {over && (
            <p className="budget-plan-over-note">
              Tetti oltre lo spendibile di {formatCurrency(capsTotal - data.spendable)}: alcuni budget non
              potranno essere rispettati insieme.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
