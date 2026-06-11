import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, TrendingUp, TrendingDown,
  Repeat, CalendarClock, CreditCard, SlidersHorizontal, X,
} from 'lucide-react';
import { useProjectionSeries } from '../hooks/useDashboard';
import { useFormatCurrency } from '../hooks/useFormatCurrency';
import ProjectionChart from '../components/dashboard/ProjectionChart';
import { InputDecimal } from '../components/layout/InputNumberDecimal';
import { currencySymbol } from '../utils/currency';
import type { ProjectionEvent } from '../types';

type Mode = 'months' | 'custom';

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
} as const;

const SOURCE_LABEL = {
  recurring: 'Ricorrente',
  planned: 'Pianificata',
  cc: 'Carta di credito',
} as const;

export default function ProjectionPage() {
  const { formatCurrency, currency } = useFormatCurrency();

  const [mode, setMode] = useState<Mode>('months');
  const [selectedMonths, setSelectedMonths] = useState(6);
  const [customRange, setCustomRange] = useState({ startDate: '', endDate: '' });
  const [pendingRange, setPendingRange] = useState({ startDate: '', endDate: '' });
  const [showCustom, setShowCustom] = useState(false);

  // Scenario "what-if": variazione di liquidità simulata oggi.
  const [adjust, setAdjust] = useState(0);

  // La proiezione parte da oggi: niente date di inizio nel passato (baseline errata).
  const todayIso = new Date().toISOString().slice(0, 10);

  const queryParams =
    mode === 'months'
      ? { months: selectedMonths, historyDays: historyForMonths(selectedMonths) }
      : { startDate: customRange.startDate, endDate: customRange.endDate, historyDays: 30 };

  const isCustomValid = mode === 'custom' && !!customRange.startDate && !!customRange.endDate;
  const enabled = mode === 'months' || isCustomValid;

  const { data, isFetching } = useProjectionSeries(queryParams, enabled);

  const isPendingValid =
    !!pendingRange.startDate && !!pendingRange.endDate && pendingRange.startDate < pendingRange.endDate;

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

  // Applica lo scenario: sposta solo il tratto proiettato (la storia reale non cambia).
  const adjustedPoints = useMemo(() => {
    if (!data) return [];
    if (!adjust) return data.points;
    return data.points.map((p) => (p.projected ? { ...p, balance: p.balance + adjust } : p));
  }, [data, adjust]);

  // Raggruppa gli eventi per mese.
  const groupedEvents = useMemo(() => {
    if (!data) return [] as { key: string; label: string; items: ProjectionEvent[] }[];
    const groups: Record<string, ProjectionEvent[]> = {};
    for (const ev of data.events) {
      const k = monthKey(ev.date);
      (groups[k] ??= []).push(ev);
    }
    return Object.keys(groups)
      .sort()
      .map((k) => ({ key: k, label: monthLabel(groups[k][0].date), items: groups[k] }));
  }, [data]);

  const currentBalance = data?.currentBalance ?? 0;
  const projectedBalance = (data?.projectedBalance ?? 0) + adjust;
  const delta = projectedBalance - currentBalance;
  const isPositiveDelta = delta >= 0;

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
            Proiezione della liquidità con ricorrenti, pianificate e debito carte
          </p>
        </div>
      </div>

      {/* ── Grafico + controlli ── */}
      <div className="projection-card">
        <div className="projection-header">
          <div className="projection-pills">
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
            <ProjectionChart points={adjustedPoints} height={340} />

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
              <span className="projection-meta-item is-muted">
                {data.recurringCount} fisse · {data.plannedCount} pianificate
              </span>
            </div>
          </>
        )}
      </div>

      {/* ── Dettaglio per voce ── */}
      {data && data.events.length > 0 && (
        <div className="projection-card">
          <h2 className="projection-title">Dettaglio impegni</h2>
          <div className="projection-detail">
            {groupedEvents.map((group) => (
              <div key={group.key}>
                <p className="projection-detail-month">{group.label}</p>
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
