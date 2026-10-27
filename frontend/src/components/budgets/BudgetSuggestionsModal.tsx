import { useState, useMemo } from 'react';
import { AlertTriangle, Info } from 'lucide-react';
import BaseModal from '../layout/ModalBase';
import { InputDecimal } from '../layout/InputNumberDecimal';
import BudgetAccountChips from './BudgetAccountChips';
import { useBudgetSuggestions, useApplySuggestions } from '../../hooks/useBudgets';
import type { BudgetAccountsState } from '../../hooks/useBudgetAccounts';
import { useCategories } from '../../hooks/useCategories';
import { useFormatCurrency } from '../../hooks/useFormatCurrency';
import { useAuth } from '../../contexts/AuthContext';
import { authAPI } from '../../api/client';
import { useToast } from '../../contexts/ToastContext';
import { usePayPeriod } from '../../hooks/useAnalytics';
import { apiError } from '../../utils/apiError';
import { scaleCaps } from '../../utils/budget';
import { invalidateKeysEverywhere } from '../../utils/syncChannel';
import { withBudgetKeys } from '../../utils/queryKeys';
import { formatDayMonth } from '../../utils/date';
import type { BudgetPeriod } from '../../types';

interface BudgetSuggestionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: BudgetAccountsState;
}

// Override dell'utente sulle righe: ciò che non è toccato segue la proposta.
type RowOverride = { selected?: boolean; cap?: number };

// Soglia "fine periodo": se al termine del periodo corrente mancano ≤ di questi
// giorni, proporre di default il periodo successivo (un budget per pochi giorni è inutile).
const NEXT_PERIOD_THRESHOLD_DAYS = 7;

function daysRemainingInMonth(): number {
  const now = new Date();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return lastDay - now.getDate();
}

type Mode = 'pay' | 'month';

const PERIOD_NAME: Record<BudgetPeriod, string> = {
  PAY_PERIOD: 'periodo di paga',
  MONTHLY: 'mensile',
  WEEKLY: 'settimanale',
  YEARLY: 'annuale',
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// Cruscotto del budget automatico: calcola lo spendibile del periodo (di paga o mese)
// per competenza (disponibilità netta a inizio periodo + entrate − spese fisse e
// programmate − risparmio) e propone un tetto per categoria dalla mediana della spesa
// variabile storica. L'utente sceglie quali budget creare/aggiornare e può personalizzare
// la % di risparmio e ogni tetto prima di applicare.
export default function BudgetSuggestionsModal({ isOpen, onClose, accounts }: BudgetSuggestionsModalProps) {
  const { user, updateUser } = useAuth();
  const { formatCurrency } = useFormatCurrency();
  const toast = useToast();
  const { data: expenseCategories = [] } = useCategories('EXPENSE');
  const applyMutation = useApplySuggestions();

  // Periodo: di paga se impostato, altrimenti mese solare.
  const payConfigured = !!user?.salaryCategoryId || !!user?.payDay;
  const [mode, setMode] = useState<Mode>(payConfigured ? 'pay' : 'month');
  const { data: payPeriod } = usePayPeriod(isOpen && mode === 'pay');

  // Periodo target: di default il successivo se quello corrente sta finendo.
  const [chosenOffset, setChosenOffset] = useState<number | null>(null);
  const defaultOffset = mode === 'pay'
    ? (payPeriod && payPeriod.daysToPayday <= NEXT_PERIOD_THRESHOLD_DAYS ? 1 : 0)
    : (daysRemainingInMonth() <= NEXT_PERIOD_THRESHOLD_DAYS ? 1 : 0);
  const offset: 0 | 1 = (chosenOffset ?? defaultOffset) === 1 ? 1 : 0;

  const { data, isLoading, isError } = useBudgetSuggestions(undefined, isOpen && accounts.selectedIds.length > 0, {
    period: mode,
    offset,
    accountIds: accounts.accountIdsParam,
  });

  // % risparmio come intero 0..90 (slider). La base dei suggerimenti NON dipende da
  // savingRate → spendibile e scalatura dei tetti si ricalcolano lato client senza
  // rifare la query.
  const [savingPct, setSavingPct] = useState<number>(Math.round((user?.savingRate ?? 0) * 100));
  const [overrides, setOverrides] = useState<Record<string, RowOverride>>({});
  const [savePref, setSavePref] = useState<boolean>(true);

  // Le modifiche alle righe valgono per UNA combinazione periodo/offset/conti: se cambia
  // (o il modal si chiude) si riparte dalla proposta. Un semplice refetch NON le tocca.
  const overridesKey = isOpen ? `${mode}|${offset}|${[...accounts.selectedIds].sort().join(',')}` : 'closed';
  const [lastKey, setLastKey] = useState(overridesKey);
  if (lastKey !== overridesKey) {
    setLastKey(overridesKey);
    setOverrides({});
  }

  const natureById = useMemo(
    () => new Map(expenseCategories.map((c) => [c.id, c.nature ?? null])),
    [expenseCategories],
  );

  const rate = savingPct / 100;
  // Risparmio = quota delle ENTRATE del periodo, mai oltre il disponibile (in rosso
  // non si mette da parte). Allineato al backend (budgetPlan.applySaving).
  const disposable = data?.disposable ?? 0;
  const savingTarget = data ? Math.min(Math.max(0, disposable), Math.max(0, data.expectedIncome) * rate) : 0;
  const spendable = disposable - savingTarget;
  const periodName = data ? data.window.label : '';

  // Tetti: se il backend espone rawCap li scaliamo qui con lo spendibile corrente
  // (reagisce allo slider); con una risposta vecchia usiamo suggestedCap così com'è.
  const caps = useMemo(() => {
    if (!data) return { values: [] as number[], raw: [] as number[], scaled: false, factor: 1 };
    const hasRaw = data.perCategory.length > 0 && data.perCategory.every((c) => c.rawCap !== undefined);
    if (!hasRaw) {
      return {
        values: data.perCategory.map((c) => c.suggestedCap),
        raw: data.perCategory.map((c) => c.suggestedCap),
        scaled: !!data.capsScaled,
        factor: data.scaleFactor ?? 1,
      };
    }
    const raw = data.perCategory.map((c) => c.rawCap as number);
    const res = scaleCaps(raw, disposable - savingTarget);
    return { values: res.caps, raw, scaled: res.scaled, factor: res.factor };
  }, [data, disposable, savingTarget]);

  const rowOf = (categoryId: string, index: number) => {
    const o = overrides[categoryId];
    return { selected: o?.selected ?? true, cap: o?.cap ?? caps.values[index] ?? 0 };
  };

  const selectedItems = data
    ? data.perCategory
        .map((c, i) => ({ c, row: rowOf(c.categoryId, i) }))
        .filter((x) => x.row.selected)
    : [];
  const selectedTotal = selectedItems.reduce((s, x) => s + x.row.cap, 0);
  const overspend = selectedTotal > Math.max(0, spendable) + 0.001;

  // Avvisi contestuali: rendono lo "spendibile" onesto invece di una luce verde. Calcolati
  // lato client così reagiscono allo slider del risparmio senza rifare la query.
  type Warn = { level: 'danger' | 'warning' | 'info'; text: string };
  const warnings: Warn[] = [];
  if (data) {
    if (data.expectedIncome <= 0.001) {
      warnings.push({
        level: 'danger',
        text: `Nessuna entrata prevista per ${periodName}: lo spendibile arriva tutto dalla liquidità. Spendendolo per intero resti senza riserva.`,
      });
    } else if (data.expectedIncome < data.fixedCommitments) {
      warnings.push({
        level: 'warning',
        text: `Le entrate previste (${formatCurrency(data.expectedIncome)}) non coprono gli impegni fissi (${formatCurrency(data.fixedCommitments)}): stai attingendo alla liquidità per ${formatCurrency(data.fixedCommitments - data.expectedIncome)}.`,
      });
    }
    // Solo se il risparmio è davvero a 0% per scelta (non perché il disponibile è <= 0).
    if (savingPct === 0 && disposable > 0.001 && spendable > 0) {
      warnings.push({
        level: 'warning',
        text: 'Con il risparmio a 0% lo spendibile azzera il margine di fine periodo. Alza la percentuale per trattenere una riserva.',
      });
    }
    if (data.offset === 0 && data.variableSpent > spendable + 0.001) {
      warnings.push({
        level: 'danger',
        text: `In questo periodo hai già speso ${formatCurrency(data.variableSpent)} di spese variabili, oltre lo spendibile.`,
      });
    }
    if (mode === 'pay' && !data.payPeriodConfigured) {
      warnings.push({
        level: 'info',
        text: 'Periodo di paga non impostato (Impostazioni → Preferenze): le proposte usano il mese solare.',
      });
    }
    if (data.liquidity < 0) {
      warnings.push({
        level: 'info',
        text: `La liquidità dei conti selezionati è negativa (${formatCurrency(data.liquidity)}): il margine reale è più stretto di quanto sembri.`,
      });
    }
    if (caps.scaled && data.perCategory.length > 0) {
      warnings.push({
        level: 'warning',
        text:
          spendable <= 0
            ? 'Spendibile esaurito: i tetti proposti sono a zero.'
            : `Tetti ridotti del ${Math.round((1 - caps.factor) * 100)}% per stare nello spendibile. Accanto a ogni importo vedi il tetto di partenza.`,
      });
    }
    if (data.lowConfidence && data.perCategory.length > 0) {
      warnings.push({
        level: 'info',
        text: `Storico breve: i tetti si basano su ${plural(data.historyPeriods ?? 0, 'periodo', 'periodi')}, sono indicativi.`,
      });
    }
  }

  const toggle = (id: string, current: boolean) =>
    setOverrides((r) => ({ ...r, [id]: { ...r[id], selected: !current } }));
  const setCap = (id: string, cap: number) =>
    setOverrides((r) => ({ ...r, [id]: { ...r[id], cap } }));

  const handleApply = async () => {
    const items = selectedItems
      .map((x) => ({ categoryId: x.c.categoryId, amount: x.row.cap }))
      .filter((i) => i.amount > 0);

    if (items.length === 0) {
      toast.error('Seleziona almeno un budget con un importo valido');
      return;
    }

    try {
      const res = await applyMutation.mutateAsync({ items, period: data?.budgetPeriod ?? 'MONTHLY', offset });

      // Persisti la % risparmio nel profilo (se richiesto e cambiata): non bloccare
      // l'esito dell'apply se la preferenza non si salva.
      if (savePref && Math.abs(rate - (user?.savingRate ?? 0)) > 0.0001) {
        try {
          const profile = await authAPI.updateProfile({ savingRate: rate });
          updateUser(profile.user);
          invalidateKeysEverywhere(withBudgetKeys([]));
        } catch {
          /* ignora: i budget sono già stati applicati */
        }
      }

      const parts: string[] = [];
      // Per il periodo successivo creati/aggiornati sono già "programmati": non contarli due volte.
      if (res.scheduled) {
        parts.push(plural(res.scheduled, 'programmato', 'programmati'));
      } else {
        if (res.created) parts.push(plural(res.created, 'creato', 'creati'));
        if (res.updated) parts.push(plural(res.updated, 'aggiornato', 'aggiornati'));
      }
      toast.success(
        parts.length > 0 ? `Budget: ${parts.join(', ')}` : `${res.applied ?? items.length} budget applicati`,
      );

      const notes: string[] = [];
      if (res.periodChanged?.length) {
        notes.push(
          'Periodo cambiato: ' +
            res.periodChanged.map((p) => `${p.name} (${PERIOD_NAME[p.from]} → ${PERIOD_NAME[p.to]})`).join(', '),
        );
      }
      if (res.rolloverReset?.length) {
        notes.push(`Riporto azzerato per ${res.rolloverReset.map((r) => r.name).join(', ')}`);
      }
      if (res.overlaps?.length) {
        notes.push(
          'Budget sovrapposti: ' +
            res.overlaps
              .map((o) => `${o.name} comprende già ${o.childBudgets.map((b) => b.name).join(', ')}`)
              .join('; '),
        );
      }
      if (notes.length > 0) toast.warning(notes.join('. '));

      onClose();
    } catch (error) {
      toast.error(apiError(error, "Errore nell'applicazione dei budget"));
    }
  };

  if (!isOpen) return null;

  const includedNames = data?.includedAccounts?.map((a) => a.name) ?? accounts.selectedNames;

  return (
    <BaseModal isOpen={isOpen} title="Proponi budget" onClose={onClose}>
      <div className="modal-form budget-sugg">
        {/* Periodo: di paga o mese, corrente o successivo */}
        <div className="form-group">
          <span className="form-label">Periodo da pianificare</span>
          <div className="budget-sugg-period-row">
          <div className="budget-sugg-month-seg" role="group" aria-label="Tipo di periodo">
            <button
              type="button"
              className={`budget-sugg-month-option ${mode === 'pay' ? 'is-selected' : ''}`}
              aria-pressed={mode === 'pay'}
              onClick={() => { setMode('pay'); setChosenOffset(null); }}
            >
              Periodo di paga
            </button>
            <button
              type="button"
              className={`budget-sugg-month-option ${mode === 'month' ? 'is-selected' : ''}`}
              aria-pressed={mode === 'month'}
              onClick={() => { setMode('month'); setChosenOffset(null); }}
            >
              Mese
            </button>
          </div>
          <div className="budget-sugg-month-seg" role="group" aria-label="Periodo da pianificare">
            <button
              type="button"
              className={`budget-sugg-month-option ${offset === 0 ? 'is-selected' : ''}`}
              aria-pressed={offset === 0}
              onClick={() => setChosenOffset(0)}
            >
              In corso
            </button>
            <button
              type="button"
              className={`budget-sugg-month-option ${offset === 1 ? 'is-selected' : ''}`}
              aria-pressed={offset === 1}
              onClick={() => setChosenOffset(1)}
            >
              Successivo
            </button>
          </div>
          </div>
          {data && (
            <p className="form-help">
              Periodo: <strong>{data.window.label}</strong>.{' '}
              {offset === 1
                ? `Parte dal ${formatDayMonth(data.window.start)}, il budget attuale resta invariato fino a quella data.`
                : `I budget partono dall'inizio del periodo in corso (${formatDayMonth(data.window.start)}).`}
            </p>
          )}
        </div>

        {/* Conti BANK inclusi nel cuscinetto e nei flussi (stessa selezione del box in pagina) */}
        {accounts.bankAccounts.length > 1 && <BudgetAccountChips accounts={accounts} />}
        {includedNames.length > 0 && (
          <p className="budget-sugg-included">
            Conti inclusi: <strong>{includedNames.join(', ')}</strong>
          </p>
        )}

        {isLoading ? (
          <p className="budget-sugg-empty">Calcolo dello spendibile…</p>
        ) : isError || !data ? (
          <p className="budget-sugg-empty">Impossibile calcolare i suggerimenti. Riprova.</p>
        ) : (
          <>
            <div className="form-group">
              <label className="form-label" htmlFor="saving-rate">
                Quanto vuoi mettere da parte: <strong>{savingPct}%</strong>
              </label>
              <input
                id="saving-rate"
                type="range"
                min={0}
                max={90}
                step={5}
                value={savingPct}
                onChange={(e) => setSavingPct(Number(e.target.value))}
                className="budget-sugg-slider"
              />
              <p className="form-help">
                Quota delle entrate del periodo da mettere da parte. Consigliato 10–20%.
              </p>
            </div>

            <div className="budget-sugg-breakdown">
              <div className="budget-sugg-line">
                <span>
                  Disponibile a inizio periodo
                  <span className="budget-sugg-subnote">
                    oggi {formatCurrency(data.liquidity)} sui conti
                    {data.ccDebt > 0 ? `, ${formatCurrency(data.ccDebt)} di debito carte` : ''}
                    {data.gap
                      ? `; stima fino all'inizio: −${formatCurrency(data.gap.fixed)} di impegni, −${formatCurrency(data.gap.variable)} di spese variabili${data.gap.income > 0 ? `, +${formatCurrency(data.gap.income)} di entrate` : ''}`
                      : ''}
                  </span>
                </span>
                <span>{formatCurrency(data.netStart)}</span>
              </div>
              <div className="budget-sugg-line">
                <span>Entrate del periodo</span>
                <span>+{formatCurrency(data.expectedIncome)}</span>
              </div>
              <div className="budget-sugg-line budget-sugg-line-neg">
                <span>
                  Spese fisse e programmate
                  <span className="budget-sugg-subnote">ricorrenti, pianificate e rate, anche su carta</span>
                </span>
                <span>−{formatCurrency(data.fixedCommitments)}</span>
              </div>
              <div className="budget-sugg-line budget-sugg-line-neg">
                <span>Risparmio ({savingPct}% delle entrate)</span>
                <span>−{formatCurrency(savingTarget)}</span>
              </div>
              <div className="budget-sugg-spendable">
                <span>Spendibile nel periodo</span>
                <span className="budget-sugg-spendable-amount">{formatCurrency(spendable)}</span>
              </div>
              {data.offset === 0 && (
                <div className="budget-sugg-line">
                  <span>
                    Già speso in variabili
                    <span className="budget-sugg-subnote">restano {formatCurrency(spendable - data.variableSpent)}</span>
                  </span>
                  <span>{formatCurrency(data.variableSpent)}</span>
                </div>
              )}
            </div>

            {warnings.length > 0 && (
              <ul className="budget-sugg-warnings">
                {warnings.map((w, i) => (
                  <li key={i} className={`budget-sugg-warning is-${w.level}`}>
                    {w.level === 'info' ? (
                      <Info size={15} aria-hidden="true" />
                    ) : (
                      <AlertTriangle size={15} aria-hidden="true" />
                    )}
                    <span>{w.text}</span>
                  </li>
                ))}
              </ul>
            )}

            {data.perCategory.length === 0 ? (
              <p className="form-help">
                Non c'è ancora abbastanza storico per proporre tetti per categoria.
              </p>
            ) : (
              <>
                <div className="budget-sugg-cats-head">
                  <span>Tetti proposti per categoria</span>
                  <span className={overspend ? 'budget-sugg-total over' : 'budget-sugg-total'}>
                    {formatCurrency(selectedTotal)} / {formatCurrency(Math.max(0, spendable))}
                  </span>
                </div>
                <p className="form-help">
                  Ogni tetto parte dalla <strong>mediana</strong> della tua spesa variabile negli ultimi
                  periodi{data.historyPeriods ? ` (${plural(data.historyPeriods, 'periodo', 'periodi')} con dati)` : ''}:
                  circa −15% sulle categorie <strong>discrezionali</strong>, 100% sulle{' '}
                  <strong>essenziali</strong>. Le spese fisse non hanno tetto, sono già negli impegni.
                </p>

                {overspend && (
                  <p className="budget-sugg-warning">
                    <AlertTriangle size={15} aria-hidden="true" />
                    I budget selezionati superano lo spendibile: riduci qualche tetto o la
                    percentuale di risparmio.
                  </p>
                )}

                <ul className="budget-sugg-list">
                  {data.perCategory.map((c, i) => {
                    const row = rowOf(c.categoryId, i);
                    const nature = natureById.get(c.categoryId);
                    const samePeriod = c.currentPeriod === data.budgetPeriod;
                    const showRaw = caps.scaled && Math.abs(caps.raw[i] - caps.values[i]) >= 0.005;
                    return (
                      <li key={c.categoryId} className="budget-sugg-row">
                        <label className="budget-sugg-check">
                          <input
                            type="checkbox"
                            checked={row.selected}
                            onChange={() => toggle(c.categoryId, row.selected)}
                          />
                          <span className="budget-sugg-cat">
                            {c.icon && (
                              <span className="budget-sugg-icon" aria-hidden="true">
                                {c.icon}
                              </span>
                            )}
                            <span className="budget-sugg-name">{c.name}</span>
                            {nature && (
                              <span className="budget-sugg-nature">
                                {nature === 'ESSENTIAL' ? 'essenziale' : 'discrezionale'}
                              </span>
                            )}
                          </span>
                        </label>

                        <div className="budget-sugg-cap">
                          <InputDecimal
                            formData={{ amount: row.cap }}
                            setFormData={(d) => setCap(c.categoryId, d.amount)}
                            label={`Tetto per ${c.name}`}
                            hideLabel
                          />
                        </div>

                        <div className="budget-sugg-detail">
                          <span className="budget-sugg-avg">mediana {formatCurrency(c.avgPerPeriod)} per periodo</span>
                          {showRaw && (
                            <span className="budget-sugg-raw">
                              da <s>{formatCurrency(caps.raw[i])}</s>
                            </span>
                          )}
                          {c.currentBudgetId && c.currentAmount !== null ? (
                            <span className={`budget-sugg-change ${samePeriod ? '' : 'is-period'}`}>
                              ora {formatCurrency(c.currentAmount)}
                              {c.currentPeriod ? ` (${PERIOD_NAME[c.currentPeriod]})` : ''} →{' '}
                              {formatCurrency(row.cap)} ({PERIOD_NAME[data.budgetPeriod]})
                            </span>
                          ) : (
                            <span className="budget-sugg-badge is-new">nuovo</span>
                          )}
                        </div>

                        {c.childBudgets && c.childBudgets.length > 0 && (
                          <p className="budget-sugg-overlap">
                            <AlertTriangle size={14} aria-hidden="true" />
                            <span>
                              Comprende già budget su:{' '}
                              {c.childBudgets.map((b) => `${b.name} (${formatCurrency(b.amount)})`).join(', ')}.
                              Rischi di contare due volte la stessa spesa.
                            </span>
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </>
            )}

            <label className="budget-sugg-savepref">
              <input
                type="checkbox"
                checked={savePref}
                onChange={(e) => setSavePref(e.target.checked)}
              />
              Salva questa percentuale di risparmio nel profilo
            </label>

            <div className="form-actions">
              <button type="button" className="btn btn-ghost btn-md btn-cancel" onClick={onClose}>
                Annulla
              </button>
              <button
                type="button"
                className="btn btn-primary btn-md"
                onClick={handleApply}
                disabled={applyMutation.isPending || selectedItems.length === 0}
              >
                {applyMutation.isPending
                  ? 'Applico…'
                  : `Applica selezionati (${selectedItems.length})`}
              </button>
            </div>
          </>
        )}
      </div>
    </BaseModal>
  );
}
