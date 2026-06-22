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

interface BudgetSuggestionsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type RowState = { selected: boolean; cap: number };

// Soglia "fine mese": se i giorni residui nel mese corrente sono ≤ di questo valore,
// proporre di default il mese prossimo (un budget mensile per pochi giorni è inutile).
const NEXT_MONTH_THRESHOLD_DAYS = 7;

function daysRemainingInMonth(): number {
  const now = new Date();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return lastDay - now.getDate();
}

// Nome del mese target (offset 0 = corrente, 1 = prossimo), es. "luglio 2026".
function monthLabel(offset: number): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  return d.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
}

// Cruscotto del budget automatico: calcola lo spendibile del mese (entrate previste
// + cuscinetto di liquidità − impegni fissi − risparmio target) e propone un tetto
// per categoria dalle medie storiche. L'utente sceglie quali budget creare/aggiornare
// e può personalizzare la % di risparmio e ogni tetto prima di applicare.
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

  // Mese target: di default il prossimo se siamo a fine mese, altrimenti il corrente.
  const [monthOffset, setMonthOffset] = useState<number>(
    daysRemainingInMonth() <= NEXT_MONTH_THRESHOLD_DAYS ? 1 : 0,
  );

  // Tutti i BANK selezionati ⇒ nessun filtro (cache stabile, identico all'overview).
  // Un sottoinsieme stretto ⇒ passa la lista al backend.
  const accountIdsParam = useMemo(() => {
    if (!selectedAccountIds) return undefined;
    if (selectedAccountIds.length === bankAccounts.length) return undefined;
    return selectedAccountIds;
  }, [selectedAccountIds, bankAccounts.length]);

  const { data, isLoading, isError } = useBudgetSuggestions(
    undefined,
    isOpen,
    monthOffset,
    accountIdsParam,
  );

  // % risparmio come intero 0..90 (slider). La base dei suggerimenti NON dipende da
  // savingRate → lo spendibile si ricalcola lato client senza rifare la query.
  const [savingPct, setSavingPct] = useState<number>(Math.round((user?.savingRate ?? 0) * 100));
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [savePref, setSavePref] = useState<boolean>(true);

  useEffect(() => {
    if (!data) return;
    // Reinizializza solo le righe per-categoria (lo slider resta dove l'utente l'ha
    // messo, anche cambiando mese o conti).
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
  // Risparmio = quota del disponibile (entrate + cuscinetto − impegni), non delle sole
  // entrate: lo slider funziona anche a reddito zero. Clamp a 0 se in rosso. Allineato
  // al backend (budget.controller getBudgetSuggestions).
  const disposable = data ? data.expectedIncome + data.cushion - data.fixedCommitments : 0;
  const savingTarget = Math.max(0, disposable) * rate;
  const spendable = disposable - savingTarget;

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
    const mese = monthLabel(monthOffset);
    if (data.expectedIncome <= 0.001) {
      warnings.push({
        level: 'danger',
        text: `Nessuna entrata prevista per ${mese}: lo spendibile arriva tutto dalla liquidità. Spendendolo per intero resti senza riserva.`,
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
        text: 'Con il risparmio a 0% lo spendibile azzera il margine di fine mese. Alza la percentuale per trattenere una riserva.',
      });
    }
    if (data.deferredCcMonthly > 0.01) {
      warnings.push({
        level: 'info',
        text: `Ricorrenti su carta per ${formatCurrency(data.deferredCcMonthly)}/mese: non pesano su questo spendibile, le paghi nell'addebito di un mese successivo.`,
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
      await applyMutation.mutateAsync(items);

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
        {/* Mese target: corrente / prossimo (sempre interattivo) */}
        <div className="form-group">
          <span className="form-label">Mese da pianificare</span>
          <div className="budget-sugg-month-seg" role="group" aria-label="Mese da pianificare">
            <button
              type="button"
              className={`budget-sugg-month-option ${monthOffset === 0 ? 'is-selected' : ''}`}
              aria-pressed={monthOffset === 0}
              onClick={() => setMonthOffset(0)}
            >
              {monthLabel(0)}
            </button>
            <button
              type="button"
              className={`budget-sugg-month-option ${monthOffset === 1 ? 'is-selected' : ''}`}
              aria-pressed={monthOffset === 1}
              onClick={() => setMonthOffset(1)}
            >
              {monthLabel(1)}
            </button>
          </div>
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
                Consigliato 10–20%. Una percentuale alta riduce molto lo spendibile del mese.
              </p>
            </div>

            <div className="budget-sugg-breakdown">
              <div className="budget-sugg-line">
                <span>{allSelected ? 'Liquidità conti' : 'Liquidità conti selezionati'}</span>
                <span>{formatCurrency(data.liquidity)}</span>
              </div>
              {monthOffset === 1 && (
                <div className="budget-sugg-line">
                  <span>In arrivo entro fine {monthLabel(0)}</span>
                  <span>
                    {data.cushion - data.liquidity >= 0 ? '+' : '−'}
                    {formatCurrency(Math.abs(data.cushion - data.liquidity))}
                  </span>
                </div>
              )}
              <div className="budget-sugg-line">
                <span>Entrate previste ({monthLabel(monthOffset)})</span>
                <span>+{formatCurrency(data.expectedIncome)}</span>
              </div>
              <div className="budget-sugg-line budget-sugg-line-neg">
                <span>
                  Impegni fissi
                  {data.ccDueThisMonth > 0 && (
                    <span className="budget-sugg-subnote">
                      incl. carta {formatCurrency(data.ccDueThisMonth)}
                    </span>
                  )}
                </span>
                <span>−{formatCurrency(data.fixedCommitments)}</span>
              </div>
              <div className="budget-sugg-line budget-sugg-line-neg">
                <span>Risparmio ({savingPct}%)</span>
                <span>−{formatCurrency(savingTarget)}</span>
              </div>
              <div className="budget-sugg-spendable">
                <span>Spendibile per {monthLabel(monthOffset)}</span>
                <span className="budget-sugg-spendable-amount">{formatCurrency(spendable)}</span>
              </div>
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
                  <span>Budget proposti dalle tue medie</span>
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
                          <span className="budget-sugg-avg">media {formatCurrency(c.avgMonthly)}</span>
                          <span
                            className={
                              c.currentBudgetId
                                ? 'budget-sugg-badge'
                                : 'budget-sugg-badge is-new'
                            }
                          >
                            {c.currentBudgetId ? 'aggiorna' : 'nuovo'}
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
              <button type="button" className="btn btn-ghost btn-md" onClick={onClose}>
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
