import { Calendar } from 'lucide-react';
import type { ProjectedBalance } from '../../types/index';
import {useState} from 'react';

interface ProjectedDetailCardProp {
  projectedBalance: ProjectedBalance;
  projectionMonths: number;
  setProjectionMonths: (value: number) => void;
  setProjectionRange: (value: object) => void;
}

export default function ProjectedDetailCard({
  projectedBalance,
  projectionMonths,
  setProjectionMonths,
  setProjectionRange
}: ProjectedDetailCardProp) {
  const [projectRange, setProjectRange] = useState({ startDate: '', endDate: '' });

  if (!projectedBalance) {
    return (
      <div className="card-gradient-purple card-lg mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="icon-md text-primary-600" />
          <p className="text-lg font-semibold text-neutral-900">
            In attesa di dati di proiezione...
          </p>
        </div>
      </div>
    );
  }
  return (

    <div className="card-gradient-purple card-lg mb-8">
      <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-2 mb-4 md:mb-4">
        <div className="flex items-center gap-2">
          <Calendar className="icon-md text-primary-600" />
          <h2 className="text-2xl md:text-3xl font-semibold text-neutral-900">
            Proiezione
          </h2>
        </div>
        {/* Sezione filtri*/ }
        <select
            value={projectionMonths}
            onChange={(e) => setProjectionMonths(Number(e.target.value))}
            className="w-full md:w-auto text-base md:text-lg bg-white/20 rounded px-3 md:px-2 py-2 md:py-1 border-0 cursor-pointer font-medium shadow-md"
            onClick={(e) => e.stopPropagation()}
          >
            <option value="1">1 Mese</option>
            <option value="3">3 Mesi</option>
            <option value="6">6 Mesi</option>
            <option value="12">12 Mesi</option>
          </select>
      </div>
      <div className="flex flex-col md:flex-row md:items-center gap-3 mb-6">
        <p className="text-sm text-neutral-600 md:whitespace-nowrap">Seleziona il periodo di proiezione</p>
        <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto md:gap-2">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 flex-1">
            <p className="text-sm text-neutral-600 hidden sm:block">da</p>
            <input 
             type="date"
             name="startDate"
             className="w-full sm:flex-1 md:w-auto text-base bg-white/20 rounded px-3 py-2 border-0 cursor-pointer shadow-md"
             onChange={(e) => setProjectRange({...projectRange, startDate: e.target.value})}
            />
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 flex-1">
            <p className="text-sm text-neutral-600 hidden sm:block">a</p>
            <input 
             type="date"
             name="endDate"
             className="w-full sm:flex-1 md:w-auto text-base bg-white/20 rounded px-3 py-2 border-0 cursor-pointer shadow-md"
              onChange={(e) => setProjectRange({...projectRange, endDate: e.target.value})}
            />
          </div>
        </div>
        {(projectRange.startDate && projectRange.endDate) &&( 
          <input type= "button"
          value="Applica"
          disabled={!projectRange.startDate || !projectRange.endDate}
          className="w-full md:w-auto text-base md:text-sm bg-primary-600 hover:bg-primary-700 text-white px-4 md:px-3 py-2 md:py-1 rounded font-medium transition-colors"
          onClick={() => setProjectionRange(projectRange)}
        />)}
       
      </div>

      {/* Sezione schede dati */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="card card-md">
          <p className="text-sm text-neutral-600 mb-1">Entrate Previste</p>
          <p className="text-xl font-bold text-success-600">
            +€{(projectedBalance?.projectedIncome ?? 0).toFixed(2)}
          </p>
        </div>
        <div className="card card-md">
          <p className="text-sm text-neutral-600 mb-1">Uscite Previste</p>
          <p className="text-xl font-bold text-danger-600">
            -€{(projectedBalance?.projectedExpense ?? 0).toFixed(2)}
          </p>
        </div>
        <div className="gradient-primary card-md">
          <p className="text-sm text-white/90 mb-1">Saldo Previsto Finale</p>
          <p className="text-xl font-bold text-white">
            €{(projectedBalance?.projectedBalance ?? 0).toFixed(2)}
          </p>
          <p className="text-xs text-white/75 mt-1">
            {projectedBalance &&
              (
                (projectedBalance.projectedBalance ?? 0) - (projectedBalance.currentBalance ?? 0) >= 0
                  ? '+'
                  : ''
              )}
            €
            {projectedBalance ? (
              (
                (projectedBalance.projectedBalance ?? 0) - (projectedBalance.currentBalance ?? 0)
              ).toFixed(2)
            ) : (
              '0.00'
            )}
          </p>
          <p className="text-xs text-white/75 mt-1">
            {projectedBalance?.recurringCount ?? 0} fisse + {projectedBalance?.plannedCount ?? 0}{' '}
            pianificate
          </p>
        </div>
        
      </div>
    </div>
  );
}