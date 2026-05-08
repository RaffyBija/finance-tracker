import { Calendar, TrendingUp, TrendingDown, Wallet, X } from 'lucide-react';
import { useState } from 'react';
import { useProjectedBalance } from '../../hooks/useDashboard';

type Mode = 'months' | 'custom';

// ── Skeleton ──────────────────────────────────────────────────────────────────

function ProjectedSkeleton() {
  return (
    <div className="card-gradient-purple card-lg mb-8 animate-pulse">
      <div className="flex flex-col md:flex-row md:items-center gap-3 mb-6">
        <div className="h-8 w-36 bg-purple-200/60 rounded" />
        <div className="h-9 w-32 bg-purple-200/60 rounded" />
      </div>
      <div className="h-4 w-64 bg-purple-200/40 rounded mb-4" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="card card-md">
            <div className="h-3 w-24 bg-neutral-200 rounded mb-3" />
            <div className="h-7 w-28 bg-neutral-200 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Componente principale ─────────────────────────────────────────────────────

export default function ProjectedDetailCard() {
  const [mode, setMode] = useState<Mode>('months');
  const [selectedMonths, setSelectedMonths] = useState(1);
  const [customRange, setCustomRange] = useState({ startDate: '', endDate: '' });
  const [pendingRange, setPendingRange] = useState({ startDate: '', endDate: '' });

  // Parametri derivati dalla modalità attiva
  const queryParams =
    mode === 'months'
      ? { months: selectedMonths }
      : { startDate: customRange.startDate, endDate: customRange.endDate };

  const isCustomValid =
    mode === 'custom' && !!customRange.startDate && !!customRange.endDate;
  const enabled = mode === 'months' || isCustomValid;

  const { data, isFetching } = useProjectedBalance(queryParams, enabled);

  // ── Handlers ──

  const handleMonthsChange = (months: number) => {
    setSelectedMonths(months);
    setMode('months');
    setPendingRange({ startDate: '', endDate: '' });
    setCustomRange({ startDate: '', endDate: '' });
  };

  const handleApplyCustom = () => {
    if (!pendingRange.startDate || !pendingRange.endDate) return;
    if (pendingRange.startDate >= pendingRange.endDate) return;
    setCustomRange(pendingRange);
    setMode('custom');
  };

  const handleClearCustom = () => {
    setPendingRange({ startDate: '', endDate: '' });
    setCustomRange({ startDate: '', endDate: '' });
    setMode('months');
  };

  const isPendingValid =
    !!pendingRange.startDate &&
    !!pendingRange.endDate &&
    pendingRange.startDate < pendingRange.endDate;

  const delta = (data?.projectedBalance ?? 0) - (data?.currentBalance ?? 0);
  const isPositiveDelta = delta >= 0;

  // Primo caricamento — skeleton completo
  if (isFetching && !data) {
    return <ProjectedSkeleton />;
  }

  return (
    <div className="card-gradient-purple card-lg mb-8">

      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4 mb-5">
        <div className="flex items-center gap-2 flex-shrink-0">
          <Calendar className="icon-md text-primary-600" />
          <h2 className="text-2xl font-semibold text-neutral-900">Proiezione</h2>
        </div>

        {/* Selettore mesi */}
        <select
          value={mode === 'months' ? selectedMonths : ''}
          onChange={(e) => handleMonthsChange(Number(e.target.value))}
          className="w-full md:w-auto text-base bg-white/60 rounded-lg px-3 py-2 border border-white/40 cursor-pointer font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
        >
          <option value={1}>1 Mese</option>
          <option value={3}>3 Mesi</option>
          <option value={6}>6 Mesi</option>
          <option value={12}>12 Mesi</option>
        </select>

        {/* Badge modalità attiva */}
        {mode === 'custom' && (
          <div className="flex items-center gap-2 bg-primary-100 text-primary-700 text-sm font-medium px-3 py-1.5 rounded-full">
            <span>
              {customRange.startDate} → {customRange.endDate}
            </span>
            <button
              onClick={handleClearCustom}
              className="hover:text-primary-900 transition-colors"
              title="Rimuovi intervallo personalizzato"
            >
              <X className="icon-sm" />
            </button>
          </div>
        )}
      </div>

      {/* ── Filtro range personalizzato ── */}
      <div className="flex flex-col sm:flex-row sm:items-end gap-3 mb-6 p-4 bg-white/30 rounded-xl border border-white/40">
        <p className="text-sm font-medium text-neutral-600 sm:self-center sm:whitespace-nowrap">
          Intervallo personalizzato:
        </p>

        <div className="flex flex-col sm:flex-row gap-2 flex-1">
          <div className="flex flex-col gap-1 flex-1">
            <label className="text-xs text-neutral-500">Da</label>
            <input
              type="date"
              value={pendingRange.startDate}
              max={pendingRange.endDate || undefined}
              className="w-full text-sm bg-white/70 rounded-lg px-3 py-2 border border-white/50 cursor-pointer shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
              onChange={(e) =>
                setPendingRange((prev) => ({ ...prev, startDate: e.target.value }))
              }
            />
          </div>

          <div className="flex flex-col gap-1 flex-1">
            <label className="text-xs text-neutral-500">A</label>
            <input
              type="date"
              value={pendingRange.endDate}
              min={pendingRange.startDate || undefined}
              className="w-full text-sm bg-white/70 rounded-lg px-3 py-2 border border-white/50 cursor-pointer shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
              onChange={(e) =>
                setPendingRange((prev) => ({ ...prev, endDate: e.target.value }))
              }
            />
          </div>
        </div>

        <button
          onClick={handleApplyCustom}
          disabled={!isPendingValid}
          className="btn btn-primary btn-sm flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Applica
        </button>
      </div>

      {/* ── Dati — skeleton inline al cambio filtro ── */}
      {isFetching ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 animate-pulse">
          {[0, 1, 2].map((i) => (
            <div key={i} className="card card-md">
              <div className="h-3 w-24 bg-neutral-200 rounded mb-3" />
              <div className="h-7 w-28 bg-neutral-200 rounded" />
            </div>
          ))}
        </div>
      ) : !data ? (
        <div className="text-center py-6 text-neutral-500 text-sm">
          {mode === 'custom' && !isCustomValid
            ? 'Seleziona un intervallo di date valido e premi Applica.'
            : 'Nessun dato disponibile per il periodo selezionato.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Entrate previste */}
          <div className="card card-md">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="icon-sm text-success-500" />
              <p className="text-sm text-neutral-600">Entrate Previste</p>
            </div>
            <p className="text-xl font-bold text-success-600">
              +€{data.projectedIncome.toFixed(2)}
            </p>
          </div>

          {/* Uscite previste */}
          <div className="card card-md">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="icon-sm text-danger-500" />
              <p className="text-sm text-neutral-600">Uscite Previste</p>
            </div>
            <p className="text-xl font-bold text-danger-600">
              -€{data.projectedExpense.toFixed(2)}
            </p>
          </div>

          {/* Saldo finale */}
          <div className="gradient-primary card-md rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Wallet className="icon-sm text-white/80" />
              <p className="text-sm text-white/90">Saldo Previsto Finale</p>
            </div>
            <p className="text-xl font-bold text-white">
              €{data.projectedBalance.toFixed(2)}
            </p>
            <p className="text-xs text-white/75 mt-1">
              {isPositiveDelta ? '+' : ''}€{delta.toFixed(2)} rispetto ad oggi
            </p>
            <p className="text-xs text-white/60 mt-0.5">
              {data.recurringCount} fisse · {data.plannedCount} pianificate
            </p>
          </div>
        </div>
      )}
    </div>
  );
}