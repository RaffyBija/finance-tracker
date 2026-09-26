import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { AnalysisPeriod } from '../../types';
import { periodLabel } from './ui';

// Periodo analizzato (condiviso da Spese, Categorie e Abitudini): frecce per
// scorrere tra i periodi caricati, etichetta con "in corso" sull'ultimo.

interface PeriodPickerProps {
  periods: AnalysisPeriod[];
  mode: 'pay' | 'month';
  selected: number;
  onChange: (index: number) => void;
}

export default function PeriodPicker({ periods, mode, selected, onChange }: PeriodPickerProps) {
  const p = periods[selected];
  if (!p) return null;
  return (
    <div className="analysis-period-picker" role="group" aria-label="Periodo analizzato">
      <button
        type="button"
        className="analysis-period-arrow"
        onClick={() => onChange(selected - 1)}
        disabled={selected === 0}
        aria-label="Periodo precedente"
      >
        <ChevronLeft size={16} />
      </button>
      <span className="analysis-period-label" aria-live="polite">
        {periodLabel(p, mode)}
        {p.isCurrent && <span className="analysis-period-badge">in corso</span>}
      </span>
      <button
        type="button"
        className="analysis-period-arrow"
        onClick={() => onChange(selected + 1)}
        disabled={selected === periods.length - 1}
        aria-label="Periodo successivo"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
}
