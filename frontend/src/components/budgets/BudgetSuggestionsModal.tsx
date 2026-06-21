import { useState, useEffect, useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import BaseModal from '../layout/ModalBase';
import { InputDecimal } from '../layout/InputNumberDecimal';
import { useBudgetSuggestions, useApplySuggestions } from '../../hooks/useBudgets';
import { useFormatCurrency } from '../../hooks/useFormatCurrency';
import { useAuth } from '../../contexts/AuthContext';
import { authAPI } from '../../api/client';
import { useToast } from '../../contexts/ToastContext';

interface BudgetSuggestionsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type RowState = { selected: boolean; cap: number };

// Cruscotto del budget automatico: calcola lo spendibile del mese (entrate previste
// + cuscinetto di liquidità − impegni fissi − risparmio target) e propone un tetto
// per categoria dalle medie storiche. L'utente sceglie quali budget creare/aggiornare
// e può personalizzare la % di risparmio e ogni tetto prima di applicare.
export default function BudgetSuggestionsModal({ isOpen, onClose }: BudgetSuggestionsModalProps) {
  const { user, updateUser } = useAuth();
  const { formatCurrency } = useFormatCurrency();
  const toast = useToast();
  const { data, isLoading, isError } = useBudgetSuggestions(undefined, isOpen);
  const applyMutation = useApplySuggestions();

  // % risparmio come intero 0..90 (slider). La base dei suggerimenti NON dipende da
  // savingRate → lo spendibile si ricalcola lato client senza rifare la query.
  const [savingPct, setSavingPct] = useState<number>(Math.round((user?.savingRate ?? 0) * 100));
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [savePref, setSavePref] = useState<boolean>(true);

  useEffect(() => {
    if (!data) return;
    setSavingPct(Math.round((data.savingRate ?? 0) * 100));
    const init: Record<string, RowState> = {};
    for (const c of data.perCategory) init[c.categoryId] = { selected: true, cap: c.suggestedCap };
    setRows(init);
  }, [data]);

  const rate = savingPct / 100;
  const savingTarget = data ? data.expectedIncome * rate : 0;
  const spendable = data
    ? data.expectedIncome + data.cushion - data.fixedCommitments - savingTarget
    : 0;

  const selectedItems = useMemo(
    () => (data ? data.perCategory.filter((c) => rows[c.categoryId]?.selected) : []),
    [data, rows],
  );
  const selectedTotal = selectedItems.reduce(
    (s, c) => s + (rows[c.categoryId]?.cap ?? 0),
    0,
  );
  const overspend = selectedTotal > spendable + 0.001;

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
                <span>Entrate previste</span>
                <span>{formatCurrency(data.expectedIncome)}</span>
              </div>
              <div className="budget-sugg-line">
                <span>Liquidità disponibile</span>
                <span>{formatCurrency(data.cushion)}</span>
              </div>
              <div className="budget-sugg-line budget-sugg-line-neg">
                <span>Impegni fissi</span>
                <span>−{formatCurrency(data.fixedCommitments)}</span>
              </div>
              <div className="budget-sugg-line budget-sugg-line-neg">
                <span>Risparmio ({savingPct}%)</span>
                <span>−{formatCurrency(savingTarget)}</span>
              </div>
              <div className="budget-sugg-spendable">
                <span>Spendibile questo mese</span>
                <span className="budget-sugg-spendable-amount">{formatCurrency(spendable)}</span>
              </div>
            </div>

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
