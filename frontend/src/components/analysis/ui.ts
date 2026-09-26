import { useTheme } from '../../contexts/ThemeContext';
import type { AnalysisPeriod, ExpenseKind } from '../../types';
import type { Tone } from '../patrimonio/tone';

// Colori delle tre nature di spesa (validati con lo script dataviz: chiaro e
// scuro, separazione CVD con legenda ed etichette sempre presenti).
//   fisse = viola, programmate = azzurro (il colore "pianificato" del design
//   system), variabili = ambra (lo stesso del ritmo quotidiano in Proiezione).
const KIND_COLORS: Record<'light' | 'dark', Record<ExpenseKind, string>> = {
  light: { fixed: '#7c3aed', planned: '#0284c7', variable: '#d97706' },
  dark: { fixed: '#8b5cf6', planned: '#0284c7', variable: '#d97706' },
};

export function useChartTheme() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  return {
    isDark,
    kind: KIND_COLORS[isDark ? 'dark' : 'light'],
    grid: isDark ? '#44403c' : '#f1f0ee',
    axis: isDark ? '#78716c' : '#a8a29e',
    surface: isDark ? '#292524' : '#ffffff',
    income: isDark ? '#34d399' : '#059669',
    neutralBar: isDark ? '#57534e' : '#d6d3d1',
  };
}

// In una spesa, spendere DI PIÙ è il segnale negativo.
export const spendTone = (delta: number | null): Tone =>
  delta === null || Math.abs(delta) < 0.005 ? 'neutral' : delta > 0 ? 'negative' : 'positive';

const lastDayIso = (endExcl: string) => {
  const d = new Date(endExcl + 'T00:00:00');
  d.setDate(d.getDate() - 1);
  return d;
};

const short = (d: Date) => d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });

// Etichetta di un periodo: "24 set – 22 ott" (paga) oppure "settembre 2026" (mese).
export function periodLabel(p: AnalysisPeriod, mode: 'pay' | 'month'): string {
  const start = new Date(p.start + 'T00:00:00');
  if (mode === 'month') {
    const label = start.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
    return label.charAt(0).toUpperCase() + label.slice(1);
  }
  return `${short(start)} – ${short(lastDayIso(p.end))}`;
}

// Etichetta compatta per gli assi dei grafici.
export function periodAxisLabel(p: AnalysisPeriod, mode: 'pay' | 'month'): string {
  const start = new Date(p.start + 'T00:00:00');
  return mode === 'month'
    ? start.toLocaleDateString('it-IT', { month: 'short' })
    : short(start);
}

export const dayLabel = (iso: string) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });

export const pct = (x: number) => `${Math.round(x * 100)}%`;
