import { Calendar } from 'lucide-react';
import type { ProjectedBalance } from '../../types/index';

interface ProjectedDetailCardProp {
  projectedBalance: ProjectedBalance;
  projectionMonths: number;
  setProjectionMonths: (value: number) => void;
}

export default function ProjectedDetailCard({
  projectedBalance,
  projectionMonths,
  setProjectionMonths,
}: ProjectedDetailCardProp) {
  return (
    <div className="card-gradient-purple card-lg mb-8">
      <div className="flex items-center gap-2 mb-4">
        <Calendar className="icon-md text-primary-600" />
        <h2 className="flex items-end gap-4 text-3xl font-semibold text-neutral-900">
          Proiezione
          <select
            value={projectionMonths}
            onChange={(e) => setProjectionMonths(Number(e.target.value))}
            className="form-select text-lg bg-white/20 rounded px-2 py-1 border-0 cursor-pointer"
            onClick={(e) => e.stopPropagation()}
          >
            <option value="1">1 Mese</option>
            <option value="3">3 Mesi</option>
            <option value="6">6 Mesi</option>
            <option value="12">12 Mesi</option>
          </select>
        </h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="card card-md">
          <p className="text-sm text-neutral-600 mb-1">Entrate Previste</p>
          <p className="text-xl font-bold text-success-600">
            +€{projectedBalance.projectedIncome.toFixed(2)}
          </p>
        </div>
        <div className="card card-md">
          <p className="text-sm text-neutral-600 mb-1">Uscite Previste</p>
          <p className="text-xl font-bold text-danger-600">
            -€{projectedBalance.projectedExpense.toFixed(2)}
          </p>
        </div>
        <div className="gradient-primary card-md">
          <p className="text-sm text-white/90 mb-1">Saldo Previsto Finale</p>
          <p className="text-xl font-bold text-white">
            €{projectedBalance.projectedBalance.toFixed(2)}
          </p>
          <p className="text-xs text-white/75 mt-1">
            {projectedBalance.projectedBalance - projectedBalance.currentBalance >= 0
              ? '+'
              : ''}
            €
            {(
              projectedBalance.projectedBalance - projectedBalance.currentBalance
            ).toFixed(2)}
          </p>
          <p className="text-xs text-white/75 mt-1">
            {projectedBalance?.recurringCount} fisse + {projectedBalance?.plannedCount}{' '}
            pianificate
          </p>
        </div>
      </div>
    </div>
  );
}