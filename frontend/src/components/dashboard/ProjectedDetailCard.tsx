import { Calendar } from 'lucide-react';
import { useState } from 'react';
import { useProjectedBalance, useProjectedBalanceByDate } from '../../hooks/useDashboard';

interface ProjectedDetailCardProps {
  projectionMonths: number;
  setProjectionMonths: (value: number) => void;
  setProjectionRange: (value: object) => void;
}

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
export default function ProjectedDetailCard({
  projectionMonths,
  setProjectionMonths,
  setProjectionRange,
}: ProjectedDetailCardProps) {
  const [projectRange, setProjectRange] = useState({ startDate: '', endDate: '' });
  const isCustomRange = projectionMonths === 0;

  // Le query vivono QUI dentro — non contribuiscono al loading della DashboardPage
  const { data: projectedBalance, isFetching: fetchingMonths } = useProjectedBalance(
    projectionMonths,
    projectionMonths > 0
  );

  const { data: projectedBalanceByDate, isFetching: fetchingByDate } = useProjectedBalanceByDate(
    projectRange.startDate,
    projectRange.endDate,
    isCustomRange && !!projectRange.startDate && !!projectRange.endDate
  );

  const isFetching = fetchingMonths || fetchingByDate;
  const activeData = isCustomRange ? projectedBalanceByDate : projectedBalance;

  if (isFetching && !activeData) {
    return <ProjectedSkeleton />;
  }

  const delta = ((activeData?.projectedBalance ?? 0) - (activeData?.currentBalance ?? 0));

  return (
    <div className="card-gradient-purple card-lg mb-8">

      {/* ── Header con selettore ── */}
      <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-2 mb-4">
        <div className="flex items-center gap-2">
          <Calendar className="icon-md text-primary-600" />
          <h2 className="text-2xl md:text-3xl font-semibold text-neutral-900">
            Proiezione
          </h2>
        </div>

        <select
          value={projectionMonths}
          onChange={(e) => {
            setProjectionMonths(Number(e.target.value));
            setProjectionRange({});
          }}
          className="w-full md:w-auto text-base md:text-lg bg-white/20 rounded px-3 md:px-2 py-2 md:py-1 border-0 cursor-pointer font-medium shadow-md"
        >
          <option value="1">1 Mese</option>
          <option value="3">3 Mesi</option>
          <option value="6">6 Mesi</option>
          <option value="12">12 Mesi</option>
        </select>
      </div>

      {/* ── Filtro range personalizzato ── */}
      <div className="flex flex-col md:flex-row md:items-center gap-3 mb-6">
        <p className="text-sm text-neutral-600 md:whitespace-nowrap">
          Seleziona il periodo di proiezione
        </p>
        <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto md:gap-2">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 flex-1">
            <p className="text-sm text-neutral-600 hidden sm:block">da</p>
            <input
              type="date"
              value={projectRange.startDate}
              className="w-full sm:flex-1 md:w-auto text-base bg-white/20 rounded px-3 py-2 border-0 cursor-pointer shadow-md"
              onChange={(e) =>
                setProjectRange({ ...projectRange, startDate: e.target.value })
              }
            />
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 flex-1">
            <p className="text-sm text-neutral-600 hidden sm:block">a</p>
            <input
              type="date"
              value={projectRange.endDate}
              className="w-full sm:flex-1 md:w-auto text-base bg-white/20 rounded px-3 py-2 border-0 cursor-pointer shadow-md"
              onChange={(e) =>
                setProjectRange({ ...projectRange, endDate: e.target.value })
              }
            />
          </div>
        </div>

        {projectRange.startDate && projectRange.endDate && (
          <button
            className="w-full md:w-auto text-base md:text-sm bg-primary-600 hover:bg-primary-700 text-white px-4 md:px-3 py-2 md:py-1 rounded font-medium transition-colors"
            onClick={() => {
              setProjectionMonths(0);
              setProjectionRange(projectRange);
            }}
          >
            Applica
          </button>
        )}
      </div>

      {/* ── Dati con skeleton inline al cambio filtro ── */}
      {isFetching ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 animate-pulse">
          {[0, 1, 2].map((i) => (
            <div key={i} className="card card-md">
              <div className="h-3 w-24 bg-neutral-200 rounded mb-3" />
              <div className="h-7 w-28 bg-neutral-200 rounded" />
            </div>
          ))}
        </div>
      ) : !activeData ? (
        <p className="text-sm text-neutral-500">
          Nessun dato disponibile per il periodo selezionato.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="card card-md">
            <p className="text-sm text-neutral-600 mb-1">Entrate Previste</p>
            <p className="text-xl font-bold text-success-600">
              +€{activeData.projectedIncome.toFixed(2)}
            </p>
          </div>
          <div className="card card-md">
            <p className="text-sm text-neutral-600 mb-1">Uscite Previste</p>
            <p className="text-xl font-bold text-danger-600">
              -€{activeData.projectedExpense.toFixed(2)}
            </p>
          </div>
          <div className="gradient-primary card-md">
            <p className="text-sm text-white/90 mb-1">Saldo Previsto Finale</p>
            <p className="text-xl font-bold text-white">
              €{activeData.projectedBalance.toFixed(2)}
            </p>
            <p className="text-xs text-white/75 mt-1">
              {delta >= 0 ? '+' : ''}€{delta.toFixed(2)} rispetto ad oggi
            </p>
            <p className="text-xs text-white/75 mt-1">
              {activeData.recurringCount} fisse + {activeData.plannedCount} pianificate
            </p>
          </div>
        </div>
      )}
    </div>
  );
}