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
      <div className="flex items-center gap-2 mb-4">
        <Calendar className="icon-md text-primary-600" />
        <h2 className="flex items-end gap-4 text-3xl font-semibold text-neutral-900">
          Proiezione
          
        </h2>
        <select
            value={projectionMonths}
            onChange={(e) => setProjectionMonths(Number(e.target.value))}
            className="text-lg bg-white/20 rounded px-2 py-1 border-0 cursor-pointer"
            onClick={(e) => e.stopPropagation()}
          >
            <option value="1">1 Mese</option>
            <option value="3">3 Mesi</option>
            <option value="6">6 Mesi</option>
            <option value="12">12 Mesi</option>
          </select>
      </div>
      <div className="flex items-center gap-4 mb-6">
        <p className="text-sm text-neutral-600">Seleziona il periodo di proiezione da</p>
        <input 
         type="date"
         name="startDate"
         className="bg-white/20 rounded px-2 py-1 border-0 cursor-pointer"
         onChange={(e) => setProjectRange({...projectRange, startDate: e.target.value})}
        />
        <p className="text-sm text-neutral-600"> a </p>
        <input 
         type="date"
         name="endDate"
         className="bg-white/20 rounded px-2 py-1 border-0 cursor-pointer"
          onChange={(e) => setProjectRange({...projectRange, endDate: e.target.value})}
        />
        <input type= "button"
          value="Applica"
          className="text-sm bg-primary-600 text-white px-3 py-1 rounded"
          onClick={() => setProjectionRange(projectRange)}
        />
          
      </div>
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