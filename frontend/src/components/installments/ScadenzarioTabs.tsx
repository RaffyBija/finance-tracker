export type ScadenzarioTabKey = 'piani' | 'pianificate' | 'ricorrenti';

export interface ScadenzarioTabDef {
  key: ScadenzarioTabKey;
  label: string;
  count?: number;
}

interface Props {
  tabs: ScadenzarioTabDef[];
  active: ScadenzarioTabKey;
  onChange: (key: ScadenzarioTabKey) => void;
}

export default function ScadenzarioTabs({ tabs, active, onChange }: Props) {
  return (
    <div className="scadenzario-tabs" role="tablist" aria-label="Sezioni scadenzario">
      {tabs.map((t) => (
        <button
          key={t.key}
          role="tab"
          aria-selected={active === t.key}
          className={`scadenzario-tab${active === t.key ? ' is-active' : ''}`}
          onClick={() => onChange(t.key)}
        >
          {t.label}
          {t.count != null && t.count > 0 && (
            <span className="scadenzario-tab-badge">{t.count > 99 ? '99+' : t.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}
