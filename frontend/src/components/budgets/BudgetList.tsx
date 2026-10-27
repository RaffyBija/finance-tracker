import { AlertTriangle, CheckCircle } from 'lucide-react';
import type { Budget } from '../../types';
import EmptyState from '../shared/EmptyState';
import { useFormatCurrency } from '../../hooks/useFormatCurrency';
import { budgetPace, budgetStatus, effectiveAmount } from '../../utils/budget';
import { formatDayMonth } from '../../utils/date';

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
 * Overview dei budget, in sezioni: attivi, dal prossimo periodo, scaduti (collassata).
 * Il budget è un tetto sulla spesa VARIABILE: gli impegni fissi (ricorrenti, pianificate,
 * rate) non entrano nella cifra spesa, la card li mostra a parte come nota informativa.
 * La card è cliccabile e apre il dettaglio con lo storico.
 */
export default function BudgetList({ budgets, onOpenModal, onCardClick }: BudgetListProps) {
  const { formatCurrency } = useFormatCurrency();

  if (budgets.length === 0) {
    return (
      <EmptyState
        title="Nessun budget"
        description="Crea un tetto per la spesa variabile (spesa, svago, trasporti…): si azzera da solo a ogni periodo e ne conservi lo storico. Ricorrenti, pianificate e rate restano fuori, sono impegni fissi."
        actionLabel="Crea budget"
        onAction={onOpenModal}
      />
    );
  }

  const active = budgets.filter((b) => budgetStatus(b) === 'active');
  const upcoming = budgets.filter((b) => budgetStatus(b) === 'upcoming');
  const expired = budgets.filter((b) => budgetStatus(b) === 'expired');

  const renderCard = (budget: Budget) => {
    const status = budgetStatus(budget);
    const isActive = status === 'active';
    const pct = budget.percentage || 0;
    const tone = statusTone(pct);
    const remaining = budget.remaining ?? 0;
    const hint = isActive ? resetHint(budget.periodEnd) : null;
    // Budget effettivo del periodo corrente (= base + riporto). Fallback alla base.
    const effective = effectiveAmount(budget);
    const carry = budget.carryIn ?? 0;
    const showCarry = budget.rollover !== 'NONE' && Math.abs(carry) >= 0.005;
    const fixed = budget.fixedSpent ?? 0;
    const isGlobal = !budget.categoryId;
    const { elapsed, projected } = isActive ? budgetPace(budget) : { elapsed: null, projected: null };
    // Proiezione utile solo se non è già sforato e il ritmo porta fuori budget o è informativo.
    const showProjection = projected !== null && effective > 0 && pct < 100;

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
              {isGlobal ? 'Tetto complessivo su tutta la spesa variabile' : budget.category?.name}
            </p>
          </div>
          {isActive && (
            <div className="budget-card-actions">
              {tone === 'over' ? (
                <AlertTriangle className="icon-md text-danger-500" aria-label="Budget superato" />
              ) : tone === 'warn' ? (
                <AlertTriangle className="icon-md budget-card-icon-warn" aria-label="Vicino al limite" />
              ) : (
                <CheckCircle className="icon-md text-success-500" aria-label="Entro il budget" />
              )}
            </div>
          )}
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
          <p className={`budget-card-carry ${carry >= 0 ? 'is-positive' : 'is-negative'}`}>
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
          {elapsed !== null && (
            <span
              className="budget-card-tick"
              style={{ left: `${(elapsed * 100).toFixed(1)}%` }}
              title="Oggi: quota di periodo trascorsa"
              aria-hidden="true"
            />
          )}
        </div>

        {showProjection && (
          <p className={`budget-card-pace ${projected > effective ? 'is-over' : ''}`}>
            Al ritmo attuale finirai a {formatCurrency(projected)}
          </p>
        )}

        <div className="budget-card-meta">
          <span
            className={`budget-card-remaining ${remaining >= 0 ? 'is-positive' : 'is-negative'}`}
          >
            {remaining >= 0
              ? `${formatCurrency(remaining)} rimasti`
              : `${formatCurrency(Math.abs(remaining))} oltre il budget`}
          </span>
          <span className="budget-card-period">
            {status === 'upcoming' ? `Parte il ${formatDayMonth(budget.startDate)}` : budget.periodLabel}
            {hint && ` · ${hint}`}
          </span>
        </div>

        {fixed > 0.005 && (
          <p className="budget-card-note">
            Impegni fissi non conteggiati: {formatCurrency(fixed)}
          </p>
        )}
        {budget.payPeriodFallback && (
          <p className="budget-card-note">
            Periodo di paga non configurato: si usa il mese solare.
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="budget-sections">
      {active.length > 0 && (
        <section className="budget-section" aria-label="Budget attivi">
          <h2 className="budget-section-title">Attivi</h2>
          <div className="card-grid-2">{active.map(renderCard)}</div>
        </section>
      )}

      {upcoming.length > 0 && (
        <section className="budget-section" aria-label="Budget dal prossimo periodo">
          <h2 className="budget-section-title">Dal prossimo periodo</h2>
          <div className="card-grid-2">{upcoming.map(renderCard)}</div>
        </section>
      )}

      {expired.length > 0 && (
        <details className="budget-section budget-section-collapsed">
          <summary className="budget-section-title">Scaduti ({expired.length})</summary>
          <div className="card-grid-2">{expired.map(renderCard)}</div>
        </details>
      )}
    </div>
  );
}
