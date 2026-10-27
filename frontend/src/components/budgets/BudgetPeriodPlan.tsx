import { useMemo, useState } from 'react';
import type { Budget } from '../../types';
import { useBudgetSuggestions } from '../../hooks/useBudgets';
import { useFormatCurrency } from '../../hooks/useFormatCurrency';
import type { BudgetAccountsState } from '../../hooks/useBudgetAccounts';
import { budgetLeft, daysLabel, effectiveAmount, planBudgets, round2 } from '../../utils/budget';
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

  // Tetti dello stesso periodo del piano (senza globale né sovrapposizioni macro/sotto-categoria)
  // e quanto ne resta ancora da spendere: serve per i "liberi dopo i budget".
  const { capsTotal, capsCount, reserved } = useMemo(() => {
    const same = data ? planBudgets(budgets, data.budgetPeriod) : [];
    return {
      capsTotal: same.reduce((s, b) => s + effectiveAmount(b), 0),
      capsCount: same.length,
      reserved: same.reduce((s, b) => s + budgetLeft(b), 0),
    };
  }, [budgets, data]);

  if (isLoading) return <SkeletonCard />;
  if (isError || !data) return null;

  const remaining = data.remaining ?? data.spendable - data.variableSpent;
  const daysLeft = Math.max(1, data.daysLeft ?? data.window.days - data.window.elapsedDays);
  const perDay = data.perDay ?? Math.round(Math.max(0, remaining) / daysLeft);
  const free = round2(remaining - reserved);
  const freePerDay = Math.round(Math.max(0, free) / daysLeft);
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
        <div className="budget-plan-stat is-primary">
          <span className="budget-plan-label">Restano ora</span>
          <span className={`budget-plan-value ${remaining < 0 ? 'is-negative' : ''}`}>
            {formatCurrency(remaining)}
          </span>
          <span className="budget-plan-note">da qui a fine periodo</span>
        </div>
        <div className="budget-plan-stat">
          <span className="budget-plan-label">Al giorno</span>
          <span className="budget-plan-value">{formatCurrency(perDay)}</span>
          <span className="budget-plan-note">per {daysLabel(daysLeft)}</span>
        </div>
        <div className="budget-plan-stat">
          <span className="budget-plan-label">Spendibile del periodo</span>
          <span className="budget-plan-value">{formatCurrency(data.spendable)}</span>
          <span className="budget-plan-note">dall&apos;inizio del periodo</span>
        </div>
      </div>

      {capsCount > 0 && (
        <div className="budget-plan-free">
          <span className="budget-plan-label">Liberi dopo i budget</span>
          <span className={`budget-plan-value ${free < 0 ? 'is-negative' : ''}`}>{formatCurrency(free)}</span>
          <span className="budget-plan-note">
            {free >= 0
              ? `${formatCurrency(freePerDay)} al giorno per tutto ciò che non ha un budget, dopo ${formatCurrency(reserved)} di tetti ancora da spendere`
              : remaining < 0
                ? 'hai già speso più di quanto ti restava'
                : `i tetti ancora da spendere (${formatCurrency(reserved)}) superano ciò che ti resta`}
          </span>
        </div>
      )}

      <p className="budget-plan-balance">
        Saldo oggi sui conti inclusi: <strong>{formatCurrency(data.liquidity)}</strong>
        {data.ccDebt > 0 && <> · debito carte {formatCurrency(data.ccDebt)}</>}
      </p>

      <details className="budget-plan-breakdown">
        <summary>Come si calcola</summary>
        <div className="budget-plan-breakdown-rows">
          <div className="budget-plan-alloc-row">
            <span>Disponibile a inizio periodo</span>
            <strong>{formatCurrency(data.netStart)}</strong>
          </div>
          <div className="budget-plan-alloc-row">
            <span>+ Entrate del periodo</span>
            <strong>{formatCurrency(data.expectedIncome)}</strong>
          </div>
          <div className="budget-plan-alloc-row">
            <span>− Spese fisse e programmate</span>
            <strong>{formatCurrency(data.fixedCommitments)}</strong>
          </div>
          {data.savingTarget > 0 && (
            <div className="budget-plan-alloc-row">
              <span>− Risparmio</span>
              <strong>{formatCurrency(data.savingTarget)}</strong>
            </div>
          )}
          <div className="budget-plan-alloc-row">
            <span>= Spendibile del periodo</span>
            <strong>{formatCurrency(data.spendable)}</strong>
          </div>
          <div className="budget-plan-alloc-row">
            <span>− Già speso in variabili</span>
            <strong>{formatCurrency(data.variableSpent)}</strong>
          </div>
          <div className="budget-plan-alloc-row">
            <span>= Restano ora</span>
            <strong>{formatCurrency(remaining)}</strong>
          </div>
          {capsCount > 0 && (
            <>
              <div className="budget-plan-alloc-row">
                <span>− Tetti ancora da spendere ({capsCount})</span>
                <strong>{formatCurrency(reserved)}</strong>
              </div>
              <div className="budget-plan-alloc-row">
                <span>= Liberi dopo i budget</span>
                <strong>{formatCurrency(free)}</strong>
              </div>
            </>
          )}
        </div>
      </details>

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
              <span className="budget-plan-unallocated">Ancora da spendere {formatCurrency(reserved)}</span>
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
