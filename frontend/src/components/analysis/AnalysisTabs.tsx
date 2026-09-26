import { useRef } from 'react';
import { BarChart3, Tags, CalendarDays, Landmark } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// Le quattro schede della sezione Analisi: ognuna risponde a una domanda.

export type AnalysisTabId = 'spese' | 'categorie' | 'abitudini' | 'patrimonio';

interface TabDef {
  id: AnalysisTabId;
  label: string;
  icon: LucideIcon;
  question: string;
}

export const ANALYSIS_TABS: TabDef[] = [
  { id: 'spese', label: 'Spese', icon: BarChart3, question: 'Quanto hai speso, rispetto al solito, e di che natura' },
  { id: 'categorie', label: 'Categorie', icon: Tags, question: 'Dove va il denaro e cosa si discosta dalla media' },
  { id: 'abitudini', label: 'Abitudini', icon: CalendarDays, question: 'Come e quando spendi: giorni, importi, voci ricorrenti' },
  { id: 'patrimonio', label: 'Patrimonio', icon: Landmark, question: 'Quanto possiedi davvero, al netto di debiti e crediti' },
];

interface Props {
  active: AnalysisTabId;
  onChange: (id: AnalysisTabId) => void;
}

export default function AnalysisTabs({ active, onChange }: Props) {
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const activeDef = ANALYSIS_TABS.find((t) => t.id === active) ?? ANALYSIS_TABS[0];

  // Navigazione da tastiera tra le tab (pattern WAI-ARIA tablist).
  const onKeyDown = (e: React.KeyboardEvent, idx: number) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const dir = e.key === 'ArrowRight' ? 1 : -1;
    const next = ANALYSIS_TABS[(idx + dir + ANALYSIS_TABS.length) % ANALYSIS_TABS.length].id;
    onChange(next);
    tabRefs.current[next]?.focus();
  };

  return (
    <div className="lens-bar">
      <div className="lens-tabs" role="tablist" aria-label="Strumenti di analisi">
        {ANALYSIS_TABS.map((tab, idx) => {
          const Icon = tab.icon;
          const isActive = tab.id === active;
          return (
            <button
              key={tab.id}
              ref={(el) => { tabRefs.current[tab.id] = el; }}
              type="button"
              role="tab"
              id={`lens-tab-${tab.id}`}
              aria-selected={isActive}
              aria-controls={`lens-panel-${tab.id}`}
              tabIndex={isActive ? 0 : -1}
              className={`lens-tab${isActive ? ' is-active' : ''}`}
              onClick={() => onChange(tab.id)}
              onKeyDown={(e) => onKeyDown(e, idx)}
            >
              <Icon size={16} aria-hidden />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
      <p className="lens-subtitle">{activeDef.question}</p>
    </div>
  );
}
