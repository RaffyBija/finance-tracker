import { useRef } from 'react';
import { TrendingUp, Wallet, PiggyBank, Tags } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// Le quattro "lenti" sul patrimonio: ognuna è una domanda diversa sullo stesso
// numero (l'ancora resta l'hero). L'ordine ricalca il sottotitolo della pagina:
// "com'è cambiato · dov'è · quanto risparmio · dove spendo".

export type LensId = 'andamento' | 'composizione' | 'risparmio' | 'spese';

interface LensDef {
  id: LensId;
  label: string;
  icon: LucideIcon;
  question: string;
}

export const LENSES: LensDef[] = [
  { id: 'andamento',    label: 'Andamento',       icon: TrendingUp, question: 'Come è cambiato il tuo patrimonio nel tempo' },
  { id: 'composizione', label: 'Dove sono i soldi', icon: Wallet,    question: 'Come è distribuita la tua liquidità tra i conti' },
  { id: 'risparmio',    label: 'Risparmio',        icon: PiggyBank,  question: 'Quanto entra, quanto esce e quanto resta ogni mese' },
  { id: 'spese',        label: 'Spese',            icon: Tags,       question: 'In quali categorie se ne va il tuo denaro' },
];

interface PatrimonioLensTabsProps {
  active: LensId;
  onChange: (id: LensId) => void;
}

export default function PatrimonioLensTabs({ active, onChange }: PatrimonioLensTabsProps) {
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const activeDef = LENSES.find((l) => l.id === active) ?? LENSES[0];

  // Navigazione da tastiera tra le tab (pattern WAI-ARIA tablist).
  const onKeyDown = (e: React.KeyboardEvent, idx: number) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const dir = e.key === 'ArrowRight' ? 1 : -1;
    const next = (idx + dir + LENSES.length) % LENSES.length;
    const nextId = LENSES[next].id;
    onChange(nextId);
    tabRefs.current[nextId]?.focus();
  };

  return (
    <div className="lens-bar">
      <div className="lens-tabs" role="tablist" aria-label="Strumenti di analisi del patrimonio">
        {LENSES.map((lens, idx) => {
          const Icon = lens.icon;
          const isActive = lens.id === active;
          return (
            <button
              key={lens.id}
              ref={(el) => { tabRefs.current[lens.id] = el; }}
              type="button"
              role="tab"
              id={`lens-tab-${lens.id}`}
              aria-selected={isActive}
              aria-controls={`lens-panel-${lens.id}`}
              tabIndex={isActive ? 0 : -1}
              className={`lens-tab${isActive ? ' is-active' : ''}`}
              onClick={() => onChange(lens.id)}
              onKeyDown={(e) => onKeyDown(e, idx)}
            >
              <Icon size={16} aria-hidden />
              <span>{lens.label}</span>
            </button>
          );
        })}
      </div>
      <p className="lens-subtitle">{activeDef.question}</p>
    </div>
  );
}
