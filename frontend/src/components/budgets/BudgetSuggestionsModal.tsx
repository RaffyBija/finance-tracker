import { useState, useEffect, useMemo } from 'react';
import { AlertTriangle, Info } from 'lucide-react';
import BaseModal from '../layout/ModalBase';
import { InputDecimal } from '../layout/InputNumberDecimal';
import { useBudgetSuggestions, useApplySuggestions } from '../../hooks/useBudgets';
import { useAccounts } from '../../hooks/useAccounts';
import { useFormatCurrency } from '../../hooks/useFormatCurrency';
import { useAuth } from '../../contexts/AuthContext';
import { authAPI } from '../../api/client';
import { useToast } from '../../contexts/ToastContext';
import { usePayPeriod } from '../../hooks/useAnalytics';

interface BudgetSuggestionsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type RowState = { selected: boolean; cap: number };

// Soglia "fine periodo": se al termine del periodo corrente mancano ≤ di questi
// giorni, proporre di default il periodo successivo (un budget per pochi giorni è inutile).
const NEXT_PERIOD_THRESHOLD_DAYS = 7;

function daysRemainingInMonth(): number {
  const now = new Date();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return lastDay - now.getDate();
}

type Mode = 'pay' | 'month';

// Cruscotto del budget automatico: calcola lo spendibile del periodo (di paga o mese)
// per competenza (disponibilità netta a inizio periodo + entrate − spese fisse e
// programmate − risparmio) e propone un tetto per categoria dalla spesa variabile
// media. L'utente sceglie quali budget creare/aggiornare e può personalizzare la %
// di risparmio e ogni tetto prima di applicare.
export default function BudgetSuggestionsModal({ isOpen, onClose }: BudgetSuggestionsModalProps) {
  const { user, updateUser } = useAuth();
  const { formatCurrency } = useFormatCurrency();
  const toast = useToast();
  const { data: accounts = [] } = useAccounts();
  const applyMutation = useApplySuggestions();

  // Conti BANK selezionabili (item c). Default: SOLO il conto principale (isDefault),
  // così con molti conti non si deve deselezionare tutto; gli altri si aggiungono a mano.
  const bankAccounts = useMemo(() => accounts.filter((a) => a.type === 'BANK'), [accounts]);
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[] | null>(null);
  useEffect(() => {
    if (selectedAccountIds === null && bankAccounts.length > 0) {
      const primary = bankAccounts.find((a) => a.isDefault) ?? bankAccounts[0];
      setSelectedAccountIds([primary.id]);
    }
  }, [bankAccounts, selectedAccountIds]);

  const allSelected =
    !!selectedAccountIds && selectedAccountIds.length === bankAccounts.length;
  const selectAll = () => setSelectedAccountIds(bankAccounts.map((a) => a.id));

  // Periodo: di paga se impostato, altrimenti mese solare.
  const payConfigured = !!user?.salaryCategoryId || !!user?.payDay;
  const [mode, setMode] = useState<Mode>(payConfigured ? 'pay' : 'month');
  const { data: payPeriod } = usePayPeriod(isOpen && mode === 'pay');

  // Periodo target: di default il successivo se quello corrente sta finendo.
  const [chosenOffset, setChosenOffset] = useState<number | null>(null);
  const defaultOffset = mode === 'pay'
    ? (payPeriod && payPeriod.daysToPayday <= NEXT_PERIOD_THRESHOLD_DAYS ? 1 : 0)
    : (daysRemainingInMonth() <= NEXT_PERIOD_THRESHOLD_DAYS ? 1 : 0);
  const offset = chosenOffset ?? defaultOffset;

  // Tutti i BANK selezionati ⇒ nessun filtro (cache stabile, identico all'overview).
  // Un sottoinsieme stretto ⇒ passa la lista al backend.
  const accountIdsParam = useMemo(() => {
    if (!selectedAccountIds) return undefined;
    if (selectedAccountIds.length === bankAccounts.length) return undefined;
    return selectedAccountIds;
  }, [selectedAccountIds, bankAccounts.length]);

  const { data, isLoading, isError } = useBudgetSuggestions(undefined, isOpen, {
    period: mode,
    offset,
    accountIds: accountIdsParam,
  });

  // % risparmio come intero 0..90 (slider). La base dei suggerimenti NON dipende da
  // savingRate → lo spendibile si ricalcola lato client senza rifare la query.
  const [savingPct, setSavingPct] = useState<number>(Math.round((user?.savingRate ?? 0) * 100));
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [savePref, setSavePref] = useState<boolean>(true);

  useEffect(() => {
    if (!data) return;
    // Reinizializza solo le righe per-categoria (lo slider resta dove l'utente l'ha
    // messo, anche cambiando periodo o conti).
    const init: Record<string, RowState> = {};
    for (const c of data.perCategory) init[c.categoryId] = { selected: true, cap: c.suggestedCap };
    setRows(init);
  }, [data]);

  const toggleAccount = (id: string) =>
    setSelectedAccountIds((prev) => {
      const cur = prev ?? bankAccounts.map((a) => a.id);
      if (cur.includes(id)) {
        // Almeno un conto dev'essere incluso: non deselezionare l'ultimo (eviterebbe
        // anche l'ambiguità [] ⇄ "nessun filtro" a valle).
        if (cur.length <= 1) return cur;
        return cur.filter((x) => x !== id);
      }
      return [...cur, id];
    });

  const rate = savingPct / 100;
  // Risparmio = quota delle ENTRATE del periodo, mai oltre il disponibile (in rosso
  // non si mette da parte). Allineato al backend (budgetPlan.applySaving).
  const disposable = data?.disposable ?? 0;
  const savingTarget = data ? Math.min(Math.max(0, disposable), Math.max(0, data.expectedIncome) * rate) : 0;
  const spendable = disposable - savingTarget;
  const periodName = data ? data.window.label : '';

  const selectedItems = useMemo(
    () => (data ? data.perCategory.filter((c) => rows[c.categoryId]?.selected) : []),
    [data, rows],
  );
  const selectedTotal = selectedItems.reduce(
    (s, c) => s + (rows[c.categoryId]?.cap ?? 0),
    0,
  );
  const overspend = selectedTotal > spendable + 0.001;

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
    if (savingTarget < 0.01 && spendable > 0) {
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
  }

  const toggle = (id: string) =>
    setRows((r) => ({ ...r, [id]: { ...r[id], selected: !r[id]?.selected } }));
  const setCap = (id: string, cap: number) =>
    setRows((r) => ({ ...r, [id]: { ...r[id], cap } }));

  const handleApply = async () => {
    const items = selectedItems
      .map((c) => ({ categoryId: c.categoryId, amount: rows[c.categoryId]?.cap ?? 0 }))
      .filter((i) => i.amount > 0);

    if (items.length === 0) {
      toast.error('Seleziona almeno un budget con un importo valido');
      return;
    }

    try {
      await applyMutation.mutateAsync({ items, period: data?.budgetPeriod ?? 'MONTHLY' });

      // Persisti la % risparmio nel profilo (se richiesto e cambiata): non bloccare
      // l'esito dell'apply se la preferenza non si salva.
      if (savePref && Math.abs(rate - (user?.savingRate ?? 0)) > 0.0001) {
        try {
          const res = await authAPI.updateProfile({ savingRate: rate });
          updateUser(res.user);
        } catch {
          /* ignora: i budget sono già stati applicati */
        }
      }

      toast.success(`${items.length} budget applicati`);
      onClose();
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Errore nell'applicazione dei budget");
    }
  };

  if (!isOpen) return null;

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
          {data && <p className="form-help">Periodo: <strong>{data.window.label}</strong></p>}
        </div>

        {/* Selettore conti BANK inclusi nel cuscinetto e nei flussi (item c) */}
        {bankAccounts.length > 1 && (
          <div className="form-group">
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
                const checked = !selectedAccountIds || selectedAccountIds.includes(a.id);
                return (
                  <label
                    key={a.id}
                    className={`budget-sugg-account ${checked ? 'is-selected' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleAccount(a.id)}
                    />
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
              Escludi un conto (es. risparmi): spariscono dal calcolo il suo saldo e i suoi
              flussi.
            </p>
          </div>
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
                  <span>Budget proposti dalla tua spesa variabile media</span>
                  <span className={overspend ? 'budget-sugg-total over' : 'budget-sugg-total'}>
                    {formatCurrency(selectedTotal)} / {formatCurrency(spendable)}
                  </span>
                </div>

                {overspend && (
                  <p className="budget-sugg-warning">
                    <AlertTriangle size={15} aria-hidden="true" />
                    I budget selezionati superano lo spendibile: riduci qualche tetto o la
                    percentuale di risparmio.
                  </p>
                )}

                <ul className="budget-sugg-list">
                  {data.perCategory.map((c) => {
                    const row = rows[c.categoryId];
                    return (
                      <li key={c.categoryId} className="budget-sugg-row">
                        <label className="budget-sugg-check">
                          <input
                            type="checkbox"
                            checked={!!row?.selected}
                            onChange={() => toggle(c.categoryId)}
                          />
                          <span className="budget-sugg-cat">
                            {c.icon && (
                              <span className="budget-sugg-icon" aria-hidden="true">
                                {c.icon}
                              </span>
                            )}
                            <span className="budget-sugg-name">{c.name}</span>
                          </span>
                        </label>

                        <span className="budget-sugg-meta">
                          <span className="budget-sugg-avg">media {formatCurrency(c.avgPerPeriod)} per periodo</span>
                          <span
                            className={
                              c.currentBudgetId
                                ? 'budget-sugg-badge'
                                : 'budget-sugg-badge is-new'
                            }
                            title={
                              c.currentBudgetId && c.currentPeriod !== data.budgetPeriod
                                ? `Il budget attuale diventerà ${data.budgetPeriod === 'PAY_PERIOD' ? 'per periodo di paga' : 'mensile'}`
                                : undefined
                            }
                          >
                            {c.currentBudgetId
                              ? c.currentPeriod !== data.budgetPeriod ? 'aggiorna e cambia periodo' : 'aggiorna'
                              : 'nuovo'}
                          </span>
                        </span>

                        <div className="budget-sugg-cap">
                          <InputDecimal
                            formData={{ amount: row?.cap ?? c.suggestedCap }}
                            setFormData={(d: any) => setCap(c.categoryId, d.amount)}
                            label={`Tetto per ${c.name}`}
                            hideLabel
                          />
                        </div>
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
