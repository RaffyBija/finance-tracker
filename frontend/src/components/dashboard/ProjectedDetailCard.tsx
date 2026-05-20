import { Calendar, TrendingUp, TrendingDown, ArrowRight, SlidersHorizontal, X } from 'lucide-react';
import { useState } from 'react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { useProjectedBalance } from '../../hooks/useDashboard';

type Mode = 'months' | 'custom';

const MONTH_OPTIONS = [1, 3, 6, 12] as const;

function projectedLabel(mode: Mode, months: number, endDate: string): string {
  if (mode === 'months') {
    return months === 1 ? 'Tra 1 mese' : `Tra ${months} mesi`;
  }
  if (endDate) {
    try {
      return `Entro ${format(new Date(endDate), 'd MMM yyyy', { locale: it })}`;
    } catch {
      return 'Data personalizzata';
    }
  }
  return 'Personalizzato';
}

function ProjectedSkeleton() {
  return (
    <div className="projection-card animate-pulse">
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', alignItems: 'center' }}>
        <div style={{ height: '1rem', width: '10rem', background: '#e7e5e4', borderRadius: '0.25rem' }} />
        <div style={{ display: 'flex', gap: '6px' }}>
          {[0, 1, 2, 3].map(i => (
            <div key={i} style={{ height: '1.625rem', width: '2.5rem', background: '#e7e5e4', borderRadius: '9999px' }} />
          ))}
        </div>
      </div>
      <div style={{ background: '#fafaf9', borderRadius: '0.5rem', padding: '1.25rem 1.5rem', marginBottom: '1rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '1.25rem', alignItems: 'center' }}>
          <div>
            <div style={{ height: '0.625rem', width: '2.5rem', background: '#e7e5e4', borderRadius: '0.25rem', marginBottom: '0.3rem' }} />
            <div style={{ height: '1.5rem', width: '7rem', background: '#e7e5e4', borderRadius: '0.25rem' }} />
          </div>
          <div style={{ color: '#d6d3d1' }}><ArrowRight size={20} /></div>
          <div>
            <div style={{ height: '0.625rem', width: '3.5rem', background: '#e7e5e4', borderRadius: '0.25rem', marginBottom: '0.3rem' }} />
            <div style={{ height: '1.5rem', width: '7rem', background: '#e7e5e4', borderRadius: '0.25rem' }} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProjectedDetailCard() {
  const [mode, setMode] = useState<Mode>('months');
  const [selectedMonths, setSelectedMonths] = useState(3);
  const [customRange, setCustomRange] = useState({ startDate: '', endDate: '' });
  const [pendingRange, setPendingRange] = useState({ startDate: '', endDate: '' });
  const [showCustom, setShowCustom] = useState(false);

  const queryParams =
    mode === 'months'
      ? { months: selectedMonths }
      : { startDate: customRange.startDate, endDate: customRange.endDate };

  const isCustomValid = mode === 'custom' && !!customRange.startDate && !!customRange.endDate;
  const enabled = mode === 'months' || isCustomValid;

  const { data, isFetching } = useProjectedBalance(queryParams, enabled);

  const handleMonthsChange = (months: number) => {
    setSelectedMonths(months);
    setMode('months');
    setPendingRange({ startDate: '', endDate: '' });
    setCustomRange({ startDate: '', endDate: '' });
  };

  const isPendingValid =
    !!pendingRange.startDate &&
    !!pendingRange.endDate &&
    pendingRange.startDate < pendingRange.endDate;

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

  if (isFetching && !data) return <ProjectedSkeleton />;

  const delta = (data?.projectedBalance ?? 0) - (data?.currentBalance ?? 0);
  const isPositiveDelta = delta >= 0;
  const label = projectedLabel(mode, selectedMonths, customRange.endDate);

  return (
    <div className="projection-card">

      {/* ── Header: titolo + pills ── */}
      <div className="projection-header">
        <h2 className="projection-title">
          <Calendar size={15} />
          Proiezione del saldo
        </h2>

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

      {/* ── Pannello range personalizzato (collassabile) ── */}
      <div className={`projection-custom-wrapper${showCustom ? ' is-open' : ''}`}>
        <div className="projection-custom-panel">
          <div className="projection-custom-row">
            <div className="projection-custom-field">
              <label className="form-label form-label-sm">Da</label>
              <input
                type="date"
                value={pendingRange.startDate}
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
                min={pendingRange.startDate || undefined}
                className="form-date form-input-sm"
                onChange={(e) => setPendingRange((p) => ({ ...p, endDate: e.target.value }))}
              />
            </div>
            <button
              onClick={handleApplyCustom}
              disabled={!isPendingValid}
              className="btn btn-primary btn-sm"
              style={{ flexShrink: 0 }}
            >
              Applica
            </button>
          </div>
        </div>
      </div>

      {/* ── Contenuto ── */}
      {isFetching ? (
        <div style={{ background: '#fafaf9', borderRadius: '0.5rem', padding: '1.25rem 1.5rem', marginBottom: '1rem', opacity: 0.6 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '1.25rem', alignItems: 'center' }}>
            <div>
              <div style={{ height: '0.625rem', width: '2.5rem', background: '#e7e5e4', borderRadius: '0.25rem', marginBottom: '0.3rem' }} />
              <div style={{ height: '1.5rem', width: '7rem', background: '#e7e5e4', borderRadius: '0.25rem' }} className="animate-pulse" />
            </div>
            <div style={{ color: '#d6d3d1' }}><ArrowRight size={20} /></div>
            <div>
              <div style={{ height: '0.625rem', width: '3.5rem', background: '#e7e5e4', borderRadius: '0.25rem', marginBottom: '0.3rem' }} />
              <div style={{ height: '1.5rem', width: '7rem', background: '#e7e5e4', borderRadius: '0.25rem' }} className="animate-pulse" />
            </div>
          </div>
        </div>
      ) : !data ? (
        <div style={{ textAlign: 'center', padding: '1.5rem 0', color: '#a8a29e', fontSize: '0.875rem' }}>
          {mode === 'custom' && !isCustomValid
            ? 'Seleziona un intervallo valido e premi Applica.'
            : 'Nessun dato disponibile per il periodo selezionato.'}
        </div>
      ) : (
        <>
          {/* Flow: Oggi → Tra X mesi */}
          <div className="projection-flow">
            <div className="projection-flow-node">
              <p className="projection-flow-node-label">Oggi</p>
              <p className="projection-flow-node-value">
                €{data.currentBalance.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>

            <div className="projection-flow-arrow">
              <ArrowRight size={22} />
            </div>

            <div className="projection-flow-node">
              <p className="projection-flow-node-label">{label}</p>
              <p className="projection-flow-node-value is-projected">
                €{data.projectedBalance.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className={`projection-flow-delta${isPositiveDelta ? ' is-positive' : ' is-negative'}`}>
                {isPositiveDelta ? '+' : '−'}€{Math.abs(delta).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          {/* Meta: entrate/uscite previste + conteggi */}
          <div className="projection-meta">
            <span className="projection-meta-item">
              <TrendingUp size={13} style={{ color: '#059669' }} />
              Entrate previste
              <span className="projection-meta-value projection-meta-income">
                +€{data.projectedIncome.toFixed(2)}
              </span>
            </span>
            <span className="projection-meta-item">
              <TrendingDown size={13} style={{ color: '#dc2626' }} />
              Uscite previste
              <span className="projection-meta-value projection-meta-expense">
                −€{data.projectedExpense.toFixed(2)}
              </span>
            </span>
            <span className="projection-meta-item" style={{ color: '#a8a29e' }}>
              {data.recurringCount} fisse · {data.plannedCount} pianificate
            </span>
          </div>
        </>
      )}
    </div>
  );
}
