import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, TrendingUp, TrendingDown,
  Repeat, CalendarClock, CreditCard, SlidersHorizontal, X, HelpCircle, Activity,
} from 'lucide-react';
import { useProjectionSeries } from '../hooks/useDashboard';
import { useAccounts } from '../hooks/useAccounts';
import { useFormatCurrency } from '../hooks/useFormatCurrency';
import ProjectionChart from '../components/dashboard/ProjectionChart';
import { InputDecimal } from '../components/layout/InputNumberDecimal';
import { currencySymbol } from '../utils/currency';
import type { ProjectionEvent } from '../types';

type Mode = 'months' | 'custom' | 'payday';

const RHYTHM_STORAGE_KEY = 'projectionRhythm';
const readRhythmPref = () => {
  try { return localStorage.getItem(RHYTHM_STORAGE_KEY) === '1'; } catch { return false; }
};

const addDaysIso = (iso: string, n: number) => {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const MONTH_OPTIONS = [1, 3, 6, 12, 24] as const;

// Più ampio l'orizzonte, più storia di contesto mostriamo.
const historyForMonths = (m: number) => (m >= 12 ? 90 : m >= 6 ? 60 : 30);

const monthKey = (iso: string) => iso.slice(0, 7); // YYYY-MM
const monthLabel = (iso: string) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
const dayLabel = (iso: string) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });

const SOURCE_ICON = {
  recurring: Repeat,
  planned: CalendarClock,
  cc: CreditCard,
  sospeso: HelpCircle,
} as const;

const SOURCE_LABEL = {
  recurring: 'Ricorrente',
  planned: 'Pianificata',
  cc: 'Carta di credito',
  sospeso: 'Sospeso',
} as const;

export default function ProjectionPage() {
  const { formatCurrency, currency } = useFormatCurrency();
  const { data: accounts = [] } = useAccounts();
  // Solo i conti BANK sono selezionabili: isolare una CC dal proprio ciclo di
  // fatturazione non ha senso (il suo saldo da solo non è significativo). Il ciclo
  // della CC collegata confluisce comunque nella proiezione del suo conto BANK
  // (vedi scopedAccountIds/linkedAccountId lato backend).
  const bankAccounts = accounts.filter((a) => a.type === 'BANK');

  // Default: fino al prossimo stipendio (liquidità libera al giorno dell'accredito).
  const [mode, setMode] = useState<Mode>('payday');
  const [selectedMonths, setSelectedMonths] = useState(6);
  const [customRange, setCustomRange] = useState({ startDate: '', endDate: '' });
  const [pendingRange, setPendingRange] = useState({ startDate: '', endDate: '' });
  const [showCustom, setShowCustom] = useState(false);
  const [accountFilter, setAccountFilter] = useState<string>('ALL');

  // Scenario "what-if": variazione di liquidità simulata oggi.
  const [adjust, setAdjust] = useState(0);

  // Sospesi (senza data): opt-in, di default esclusi dalla proiezione (stima
  // approssimata, contati come se accadessero oggi — mai mescolati silenziosamente).
  const [includeSuspended, setIncludeSuspended] = useState(false);

  // Ritmo quotidiano (spesa variabile stimata): opt-in, preferenza ricordata.
  // La proiezione standard (solo impegni noti) resta sempre visibile.
  const [withRhythm, setWithRhythm] = useState(readRhythmPref);
  const toggleRhythm = (on: boolean) => {
    setWithRhythm(on);
    try { localStorage.setItem(RHYTHM_STORAGE_KEY, on ? '1' : '0'); } catch { /* storage non disponibile */ }
  };
  // Override manuale €/giorno (0 = stima automatica), applicato con un piccolo
  // ritardo per non interrogare il backend a ogni tasto.
  const [rhythmInput, setRhythmInput] = useState(0);
  const [rhythmOverride, setRhythmOverride] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setRhythmOverride(rhythmInput), 450);
    return () => clearTimeout(t);
  }, [rhythmInput]);

  // La proiezione parte da oggi: niente date di inizio nel passato (baseline errata).
  const todayIso = new Date().toISOString().slice(0, 10);

  // Se il conto selezionato viene eliminato altrove, torna alla vista globale
  // invece di continuare a interrogare un accountId ormai inesistente.
  useEffect(() => {
    if (accountFilter !== 'ALL' && bankAccounts.length > 0 && !bankAccounts.some((a) => a.id === accountFilter)) {
      setAccountFilter('ALL');
    }
  }, [bankAccounts, accountFilter]);

  const accountId = accountFilter !== 'ALL' ? accountFilter : undefined;
  const selectedAccount = accountId ? bankAccounts.find((a) => a.id === accountId) : null;
  const rhythmParams = withRhythm
    ? { rhythm: true, ...(rhythmOverride > 0 ? { rhythmRate: rhythmOverride } : {}) }
    : {};
  const queryParams =
    mode === 'payday'
      ? { horizon: 'payday' as const, historyDays: 30, includeSuspended, accountId, ...rhythmParams }
      : mode === 'months'
        ? { months: selectedMonths, historyDays: historyForMonths(selectedMonths), includeSuspended, accountId, ...rhythmParams }
        : { startDate: customRange.startDate, endDate: customRange.endDate, historyDays: 30, includeSuspended, accountId, ...rhythmParams };

  const isCustomValid = mode === 'custom' && !!customRange.startDate && !!customRange.endDate;
  const enabled = mode !== 'custom' || isCustomValid;

  const { data, isFetching } = useProjectionSeries(queryParams, enabled);

  // Validazione esplicita lato JS, non ci si affida solo all'attributo HTML `min`:
  // Safari non lo applica in modo affidabile su `<input type="date">` (bug noto,
  // Firefox/Chrome invece bloccano il passato già a livello di picker nativo).
  const isPendingValid =
    !!pendingRange.startDate && !!pendingRange.endDate &&
    pendingRange.startDate >= todayIso &&
    pendingRange.startDate < pendingRange.endDate;
  const isPendingPast = !!pendingRange.startDate && pendingRange.startDate < todayIso;

  const handlePayday = () => {
    setMode('payday');
    setPendingRange({ startDate: '', endDate: '' });
    setCustomRange({ startDate: '', endDate: '' });
  };

  const handleMonthsChange = (m: number) => {
    setSelectedMonths(m);
    setMode('months');
    setPendingRange({ startDate: '', endDate: '' });
    setCustomRange({ startDate: '', endDate: '' });
  };

  const handleApplyCustom = () => {
    if (!isPendingValid) return;
    setCustomRange(pendingRange);
    setMode('custom');
  };

  const handleClearCustom = () => {
    setPendingRange({ startDate: '', endDate: '' });
    setCustomRange({ startDate: '', endDate: '' });
    setMode('months');
    setShowCustom(false);
  };

  // Scorciatoia "fine mese corrente": utile per capire subito come si chiude il
  // mese in corso, senza aprire il pannello personalizzato e scegliere le date a mano.
  const endOfMonthIso = useMemo(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
  }, []);
  const isEndOfMonthDisabled = todayIso >= endOfMonthIso; // oggi è già l'ultimo giorno del mese
  const isEndOfMonthActive =
    mode === 'custom' && customRange.startDate === todayIso && customRange.endDate === endOfMonthIso;

  const handleEndOfMonth = () => {
    if (isEndOfMonthDisabled) return;
    const range = { startDate: todayIso, endDate: endOfMonthIso };
    setPendingRange(range);
    setCustomRange(range);
    setMode('custom');
  };

  // Applica lo scenario: sposta solo il tratto proiettato (la storia reale non cambia).
  const adjustedPoints = useMemo(() => {
    if (!data) return [];
    if (!adjust) return data.points;
    const shift = (v?: number) => (v == null ? v : v + adjust);
    return data.points.map((p) => (p.projected
      ? { ...p, balance: p.balance + adjust, rhythm: shift(p.rhythm), bandLow: shift(p.bandLow), bandHigh: shift(p.bandHigh) }
      : p));
  }, [data, adjust]);

  // Indicatori sul tratto proiettato: saldo alla vigilia dello stipendio (la
  // liquidità "libera" prima dell'accredito) e punto più basso, standard e con ritmo.
  const insights = useMemo(() => {
    const projected = adjustedPoints.filter((p) => p.projected);
    if (!data || projected.length === 0) return null;
    const eveIso = addDaysIso(data.payPeriod.nextPayday, -1);
    const eve = projected.find((p) => p.date === eveIso) ?? null;
    const minBy = (get: (p: typeof projected[number]) => number | undefined) => {
      let best: { value: number; date: string } | null = null;
      for (const p of projected) {
        const v = get(p);
        if (v == null) continue;
        if (!best || v < best.value) best = { value: v, date: p.date };
      }
      return best;
    };
    return {
      eve: eve ? { date: eve.date, standard: eve.balance, rhythm: eve.rhythm ?? null } : null,
      lowest: minBy((p) => p.balance),
      lowestRhythm: minBy((p) => p.rhythm),
    };
  }, [adjustedPoints, data]);

  // Spesa del ritmo quotidiano per mese (differenza giornaliera tra le due linee):
  // mostrata nel riepilogo mensile del dettaglio impegni.
  const rhythmByMonth = useMemo(() => {
    const out: Record<string, number> = {};
    if (!data?.rhythm) return out;
    const projected = data.points.filter((p) => p.projected);
    for (let i = 1; i < projected.length; i++) {
      const prev = projected[i - 1];
      const cur = projected[i];
      if (cur.rhythm == null || prev.rhythm == null) continue;
      const cost = (cur.balance - prev.balance) - (cur.rhythm - prev.rhythm);
      if (cost > 0.005) out[monthKey(cur.date)] = (out[monthKey(cur.date)] ?? 0) + cost;
    }
    return out;
  }, [data]);

  // Raggruppa gli eventi per mese, con i totali entrate/uscite di quel mese
  // (quadro rapido di come si chiude ogni mese, senza dover sommare le voci a mano).
  const groupedEvents = useMemo(() => {
    if (!data) return [] as { key: string; label: string; items: ProjectionEvent[]; income: number; expense: number; rhythm: number }[];
    const groups: Record<string, ProjectionEvent[]> = {};
    for (const ev of data.events) {
      const k = monthKey(ev.date);
      (groups[k] ??= []).push(ev);
    }
    for (const k of Object.keys(rhythmByMonth)) groups[k] ??= [];
    return Object.keys(groups)
      .sort()
      .map((k) => {
        const items = groups[k];
        const income = items.filter((e) => e.type === 'INCOME').reduce((s, e) => s + e.amount, 0);
        const expense = items.filter((e) => e.type === 'EXPENSE').reduce((s, e) => s + e.amount, 0);
        return { key: k, label: monthLabel(`${k}-01`), items, income, expense, rhythm: rhythmByMonth[k] ?? 0 };
      });
  }, [data, rhythmByMonth]);

  const currentBalance = data?.currentBalance ?? 0;
  const projectedBalance = (data?.projectedBalance ?? 0) + adjust;
  const delta = projectedBalance - currentBalance;
  const isPositiveDelta = delta >= 0;
  const rhythm = data?.rhythm ?? null;
  const rhythmEnd = rhythm ? rhythm.projectedBalance + adjust : null;
  const signedFmt = (n: number) => `${n < 0 ? '−' : ''}${formatCurrency(Math.abs(n))}`;

  return (
    <div className="container-custom">
      <div className="page-header">
        <div>
          <Link to="/dashboard" className="outlook-detail-link projection-back">
            <ArrowLeft size={14} />
            Torna alla dashboard
          </Link>
          <h1 className="page-header-title">Andamento del saldo</h1>
          <p className="page-header-subtitle">
            {selectedAccount
              ? `Proiezione del saldo di ${selectedAccount.name}`
              : 'Proiezione della liquidità con ricorrenti, pianificate e debito carte'}
          </p>
        </div>
      </div>

      {/* ── Grafico + controlli ── */}
      <div className="projection-card">
        <div className="projection-header">
          <div className="projection-pills">
            <button
              onClick={handlePayday}
              className={`projection-pill${mode === 'payday' ? ' is-active' : ''}`}
              title={data ? `Fino al ${dayLabel(data.payPeriod.nextPayday)}` : 'Fino al prossimo stipendio'}
            >
              Stipendio
            </button>
            {MONTH_OPTIONS.map((m) => (
              <button
                key={m}
                onClick={() => handleMonthsChange(m)}
                className={`projection-pill${mode === 'months' && selectedMonths === m ? ' is-active' : ''}`}
              >
                {m}M
              </button>
            ))}
          </div>

          <button
            onClick={handleEndOfMonth}
            disabled={isEndOfMonthDisabled}
            className={`projection-custom-toggle${isEndOfMonthActive ? ' is-open' : ''}`}
            title={isEndOfMonthDisabled ? 'Oggi è già l\'ultimo giorno del mese' : 'Proietta fino a fine mese'}
          >
            <CalendarClock size={13} />
            Fine mese
          </button>

          <button
            onClick={() => setShowCustom((v) => !v)}
            className={`projection-custom-toggle${showCustom ? ' is-open' : ''}`}
          >
            <SlidersHorizontal size={13} />
            {mode === 'custom' ? 'Personalizzato attivo' : 'Personalizzato'}
          </button>

          {mode === 'custom' && (
            <button onClick={handleClearCustom} className="projection-custom-toggle" title="Rimuovi intervallo">
              <X size={13} /> Rimuovi
            </button>
          )}
        </div>

        {bankAccounts.length > 1 && (
          <div className="account-filter-pills">
            <button
              className={`account-filter-pill${accountFilter === 'ALL' ? ' is-active' : ''}`}
              onClick={() => setAccountFilter('ALL')}
            >
              Tutti i conti
            </button>
            {bankAccounts.map((account) => (
              <button
                key={account.id}
                className={`account-filter-pill${accountFilter === account.id ? ' is-active' : ''}`}
                onClick={() => setAccountFilter(account.id)}
              >
                <span className="account-filter-pill-dot" style={{ backgroundColor: account.color }} />
                {account.name}
              </button>
            ))}
          </div>
        )}

        <label className="form-checkbox-row">
          <input
            type="checkbox"
            checked={includeSuspended}
            onChange={(e) => setIncludeSuspended(e.target.checked)}
          />
          Includi sospesi (stima)
        </label>
        {includeSuspended && (
          <p className="form-help">Nessuna data reale: contati come se accadessero oggi.</p>
        )}

        <label className="form-checkbox-row">
          <input
            type="checkbox"
            checked={withRhythm}
            onChange={(e) => toggleRhythm(e.target.checked)}
          />
          Includi ritmo quotidiano (stima delle spese variabili)
        </label>

        {data && mode === 'payday' && !data.payPeriod.configured && (
          <p className="form-help">
            Periodo di paga non impostato: l'orizzonte è la fine del mese.{' '}
            <Link to="/profile#preferenze" className="projection-inline-link">Imposta lo stipendio</Link>
          </p>
        )}

        <div className={`projection-custom-wrapper${showCustom ? ' is-open' : ''}`}>
          <div className="projection-custom-panel">
            <div className="projection-custom-row">
              <div className="projection-custom-field">
                <label className="form-label form-label-sm">Da</label>
                <input
                  type="date"
                  value={pendingRange.startDate}
                  min={todayIso}
                  max={pendingRange.endDate || undefined}
                  className="form-date form-input-sm"
                  onChange={(e) => setPendingRange((p) => ({ ...p, startDate: e.target.value }))}
                />
              </div>
              <div className="projection-custom-field">
                <label className="form-label form-label-sm">A</label>
                <input
                  type="date"
                  value={pendingRange.endDate}
                  min={pendingRange.startDate || todayIso}
                  className="form-date form-input-sm"
                  onChange={(e) => setPendingRange((p) => ({ ...p, endDate: e.target.value }))}
                />
              </div>
              <button onClick={handleApplyCustom} disabled={!isPendingValid} className="btn btn-primary btn-sm">
                Applica
              </button>
            </div>
            {isPendingPast && (
              <p className="form-help">La data di inizio non può essere nel passato.</p>
            )}
          </div>
        </div>

        {/* ── Scenario what-if ── */}
        <div className="projection-scenario">
          <div className="projection-scenario-field">
            <InputDecimal
              setFormData={(d: { amount: number }) => setAdjust(d.amount)}
              formData={{ amount: adjust }}
              label="Simula variazione di liquidità oggi"
              currency={currencySymbol(currency)}
              placeholder="0,00"
              allowNegative
            />
          </div>
          {adjust !== 0 && (
            <button onClick={() => setAdjust(0)} className="projection-custom-toggle" title="Azzera scenario">
              <X size={13} /> Azzera scenario
            </button>
          )}
        </div>

        {!enabled ? (
          <div className="projection-empty">Seleziona un intervallo valido e premi Applica.</div>
        ) : isFetching && !data ? (
          <div className="projection-empty">Caricamento…</div>
        ) : !data || data.points.length < 2 ? (
          <div className="projection-empty">Nessun dato disponibile per il periodo selezionato.</div>
        ) : (
          <>
            <ProjectionChart points={adjustedPoints} height={340} paydayDate={data.payPeriod.nextPayday} />

            {rhythm && (
              <div className="projection-legend">
                <span className="projection-legend-item">
                  <span className="projection-legend-swatch is-standard" /> Solo impegni noti
                </span>
                <span className="projection-legend-item">
                  <span className="projection-legend-swatch is-rhythm" /> Con ritmo quotidiano
                </span>
                {!rhythm.override && rhythm.high > rhythm.low && (
                  <span className="projection-legend-item">
                    <span className="projection-legend-swatch is-band" /> Fascia probabile
                  </span>
                )}
              </div>
            )}

            {insights && (insights.eve || insights.lowest) && (
              <div className="projection-insights">
                {insights.eve && (
                  <div className="projection-insight">
                    <span className="projection-insight-label">Prima dello stipendio · {dayLabel(insights.eve.date)}</span>
                    <span className={`projection-insight-value${insights.eve.standard < 0 ? ' is-negative' : ''}`}>
                      {signedFmt(insights.eve.standard)}
                    </span>
                    {insights.eve.rhythm != null && (
                      <span className={`projection-insight-rhythm${insights.eve.rhythm < 0 ? ' is-negative' : ''}`}>
                        con ritmo {signedFmt(insights.eve.rhythm)}
                      </span>
                    )}
                  </div>
                )}
                {insights.lowest && (
                  <div className="projection-insight">
                    <span className="projection-insight-label">Punto più basso · {dayLabel(insights.lowest.date)}</span>
                    <span className={`projection-insight-value${insights.lowest.value < 0 ? ' is-negative' : ''}`}>
                      {signedFmt(insights.lowest.value)}
                    </span>
                    {insights.lowestRhythm && (
                      <span className={`projection-insight-rhythm${insights.lowestRhythm.value < 0 ? ' is-negative' : ''}`}>
                        con ritmo {signedFmt(insights.lowestRhythm.value)} ({dayLabel(insights.lowestRhythm.date)})
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="projection-flow">
              <div className="projection-flow-node">
                <p className="projection-flow-node-label">Oggi</p>
                <p className="projection-flow-node-value">{formatCurrency(currentBalance)}</p>
              </div>
              <div className="projection-flow-arrow">
                <ArrowRight size={22} />
              </div>
              <div className="projection-flow-node">
                <p className="projection-flow-node-label">Fine periodo</p>
                <p className="projection-flow-node-value is-projected">{formatCurrency(projectedBalance)}</p>
                <p className={`projection-flow-delta${isPositiveDelta ? ' is-positive' : ' is-negative'}`}>
                  {isPositiveDelta ? '+' : '−'}{formatCurrency(Math.abs(delta))}
                </p>
                {rhythmEnd !== null && (
                  <p className="projection-flow-rhythm">con ritmo {signedFmt(rhythmEnd)}</p>
                )}
              </div>
            </div>

            <div className="projection-meta">
              <span className="projection-meta-item">
                <TrendingUp size={13} style={{ color: '#059669' }} />
                Entrate previste
                <span className="projection-meta-value projection-meta-income">+{formatCurrency(data.projectedIncome)}</span>
              </span>
              <span className="projection-meta-item">
                <TrendingDown size={13} style={{ color: '#dc2626' }} />
                Uscite previste
                <span className="projection-meta-value projection-meta-expense">−{formatCurrency(data.projectedExpense)}</span>
              </span>
              {rhythm && (
                <span className="projection-meta-item">
                  <Activity size={13} className="projection-meta-rhythm-icon" />
                  Ritmo quotidiano stimato
                  <span className="projection-meta-value projection-meta-expense">−{formatCurrency(rhythm.totalEstimated)}</span>
                </span>
              )}
              <span className="projection-meta-item is-muted">
                {data.recurringCount} fisse · {data.plannedCount} pianificate
                {data.suspendedCount > 0 && ` · ${data.suspendedCount} sospesi`}
              </span>
            </div>
          </>
        )}
      </div>

      {/* ── Ritmo quotidiano: come è stimato + override ── */}
      {withRhythm && rhythm && (
        <div className="projection-card">
          <h2 className="projection-title">Ritmo quotidiano</h2>
          <p className="projection-rhythm-lead">
            {rhythm.basis === 'none'
              ? 'Non ci sono ancora abbastanza spese registrate per stimare il ritmo: inseriscilo a mano qui sotto.'
              : rhythm.basis === 'current'
                ? `Circa ${formatCurrency(rhythm.dailyRate)} al giorno, stimato sul periodo di paga in corso (nessun periodo chiuso con dati).`
                : `Circa ${formatCurrency(rhythm.dailyRate)} al giorno di spese variabili, mediana degli ultimi ${rhythm.periods.length} ${rhythm.periods.length === 1 ? 'periodo' : 'periodi'} di paga${rhythm.high > rhythm.low ? ` (fascia ${formatCurrency(rhythm.low)}–${formatCurrency(rhythm.high)})` : ''}.`}
            {' '}Esclusi ricorrenti, pianificate, rate, trasferimenti e addebiti carta (gli acquisti su carta contano alla data d'acquisto e confluiscono nell'addebito del ciclo).
            {selectedAccount && ` Su ${selectedAccount.name}: ${formatCurrency(rhythm.scopeDaily)} al giorno.`}
          </p>

          {rhythm.periods.length > 0 && (
            <ul className="projection-rhythm-periods">
              {rhythm.periods.map((p) => (
                <li key={p.start} className="projection-rhythm-period">
                  <span className="projection-rhythm-period-range">{dayLabel(p.start)} – {dayLabel(addDaysIso(p.end, -1))}</span>
                  <span className="projection-rhythm-period-spent">{formatCurrency(p.spent)}</span>
                  <span className="projection-rhythm-period-rate">{formatCurrency(p.rate)}/g</span>
                </li>
              ))}
              <li className="projection-rhythm-period is-current">
                <span className="projection-rhythm-period-range">In corso, da {dayLabel(rhythm.current.start)}</span>
                <span className="projection-rhythm-period-spent">{formatCurrency(rhythm.current.spent)}</span>
                <span className="projection-rhythm-period-rate">{formatCurrency(rhythm.current.rate)}/g</span>
              </li>
            </ul>
          )}

          <div className="projection-scenario">
            <div className="projection-scenario-field">
              <InputDecimal
                setFormData={(d: { amount: number }) => setRhythmInput(d.amount)}
                formData={{ amount: rhythmInput }}
                label="Imposta il tuo ritmo (al giorno)"
                currency={currencySymbol(currency)}
                placeholder={rhythm.dailyRate > 0 ? String(rhythm.dailyRate).replace('.', ',') : '0,00'}
              />
            </div>
            {rhythmInput > 0 && (
              <button onClick={() => setRhythmInput(0)} className="projection-custom-toggle" title="Torna alla stima">
                <X size={13} /> Usa la stima
              </button>
            )}
          </div>
          {rhythm.override && (
            <p className="form-help">Ritmo impostato a mano: la fascia probabile è nascosta.</p>
          )}
        </div>
      )}

      {/* ── Dettaglio per voce ── */}
      {data && groupedEvents.length > 0 && (
        <div className="projection-card">
          <h2 className="projection-title">Dettaglio impegni</h2>
          <div className="projection-detail">
            {groupedEvents.map((group) => (
              <div key={group.key}>
                <div className="projection-detail-month-row">
                  <p className="projection-detail-month">{group.label}</p>
                  <span className="projection-detail-month-summary">
                    <span className="projection-meta-income">+{formatCurrency(group.income)}</span>
                    <span className="projection-meta-expense">−{formatCurrency(group.expense)}</span>
                  </span>
                </div>
                {group.rhythm > 0 && (
                  <div className="projection-detail-item is-rhythm">
                    <span className="projection-detail-icon"><Activity size={15} /></span>
                    <div className="projection-detail-body">
                      <p className="projection-detail-label">Spese quotidiane stimate</p>
                      <p className="projection-detail-meta">Ritmo quotidiano · stima</p>
                    </div>
                    <span className="projection-detail-amount is-expense">−{formatCurrency(group.rhythm)}</span>
                  </div>
                )}
                {group.items.map((ev, i) => {
                  const Icon = SOURCE_ICON[ev.source];
                  return (
                    <div key={`${ev.date}-${i}`} className="projection-detail-item">
                      <span className="projection-detail-icon"><Icon size={15} /></span>
                      <div className="projection-detail-body">
                        <p className="projection-detail-label">{ev.label}</p>
                        <p className="projection-detail-meta">{dayLabel(ev.date)} · {SOURCE_LABEL[ev.source]}</p>
                      </div>
                      <span className={`projection-detail-amount ${ev.type === 'INCOME' ? 'is-income' : 'is-expense'}`}>
                        {ev.type === 'INCOME' ? '+' : '−'}{formatCurrency(ev.amount)}
                      </span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
