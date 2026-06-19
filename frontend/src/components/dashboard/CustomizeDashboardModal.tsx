import { ChevronUp, ChevronDown, RotateCcw } from 'lucide-react';
import BaseModal from '../layout/ModalBase';
import { WIDGET_MAP } from './widgets/registry';
import type { LayoutItem } from '../../hooks/useDashboardLayout';
import type { WidgetId, WidgetSlot } from './widgets/registry';

interface CustomizeDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: LayoutItem[];
  toggle: (id: WidgetId) => void;
  move: (id: WidgetId, dir: 'up' | 'down') => void;
  reset: () => void;
}

const SLOT_ORDER: WidgetSlot[] = ['bar', 'tile', 'content'];
const SLOT_LABELS: Record<WidgetSlot, string> = {
  bar: 'Barra azioni',
  tile: 'Tessere',
  content: 'Riquadri',
};

export default function CustomizeDashboardModal({
  isOpen,
  onClose,
  items,
  toggle,
  move,
  reset,
}: CustomizeDashboardModalProps) {
  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title="Personalizza dashboard">
      <div className="customize-panel">
        <p className="customize-intro">
          Scegli quali riquadri mostrare e in che ordine, zona per zona. L'Hero col saldo resta sempre in cima.
        </p>

        {SLOT_ORDER.map((slot) => {
          const slotItems = items.filter((it) => WIDGET_MAP[it.id]?.slot === slot);
          if (slotItems.length === 0) return null;
          return (
            <div key={slot} className="customize-section">
              <p className="customize-section-label">{SLOT_LABELS[slot]}</p>
              <ul className="customize-list">
                {slotItems.map((item, idx) => {
                  const def = WIDGET_MAP[item.id];
                  return (
                    <li key={item.id} className={`customize-item${item.enabled ? '' : ' is-disabled'}`}>
                      <div className="customize-reorder">
                        <button
                          type="button"
                          className="btn-icon-neutral"
                          onClick={() => move(item.id, 'up')}
                          disabled={idx === 0}
                          aria-label={`Sposta ${def.title} su`}
                        >
                          <ChevronUp className="icon-sm" />
                        </button>
                        <button
                          type="button"
                          className="btn-icon-neutral"
                          onClick={() => move(item.id, 'down')}
                          disabled={idx === slotItems.length - 1}
                          aria-label={`Sposta ${def.title} giù`}
                        >
                          <ChevronDown className="icon-sm" />
                        </button>
                      </div>

                      <div className="customize-item-info">
                        <span className="customize-item-title">{def.title}</span>
                        <span className="customize-item-desc">{def.description}</span>
                      </div>

                      <label className="customize-switch">
                        <input
                          type="checkbox"
                          checked={item.enabled}
                          onChange={() => toggle(item.id)}
                          aria-label={`${item.enabled ? 'Nascondi' : 'Mostra'} ${def.title}`}
                        />
                        <span className="customize-switch-track" aria-hidden="true">
                          <span className="customize-switch-thumb" />
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}

        <div className="customize-footer">
          <button type="button" className="btn btn-ghost btn-md" onClick={reset}>
            <RotateCcw size={15} />
            Ripristina default
          </button>
          <button type="button" className="btn btn-primary btn-md" onClick={onClose}>
            Fatto
          </button>
        </div>
      </div>
    </BaseModal>
  );
}
