import "../../styles/Modal.css";
import { X } from 'lucide-react';
import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';

interface BaseModalProps {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactElement;
}

export default function BaseModal({
  isOpen,
  title,
  onClose,
  children,
}: BaseModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  // All'apertura: blocca lo scroll del body, sposta il focus dentro al modale
  // (primo campo su desktop, altrimenti il container) e — alla chiusura —
  // ripristina scroll e focus all'elemento che aveva aperto il modale.
  useEffect(() => {
    if (!isOpen) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Auto-focus sul primo campo SOLO su puntatore preciso (desktop/laptop),
    // così su mobile/tablet non si apre la tastiera. Fallback: il container.
    if (window.matchMedia('(pointer: fine)').matches) {
      const first = containerRef.current?.querySelector<HTMLElement>(
        '.modal-content input:not([type="hidden"]), .modal-content select, .modal-content textarea',
      );
      (first ?? containerRef.current)?.focus();
    } else {
      containerRef.current?.focus();
    }

    return () => {
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus?.();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // Elementi focusabili visibili dentro al modale (per il focus trap).
  const focusables = (): HTMLElement[] => {
    const c = containerRef.current;
    if (!c) return [];
    return Array.from(
      c.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((el) => el.offsetParent !== null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // ESC chiude il modale.
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
      return;
    }

    // Focus trap: Tab/Shift+Tab restano dentro al modale.
    if (e.key === 'Tab') {
      const items = focusables();
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && active === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && active === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
      return;
    }

    // Invio = invia il form (senza cliccare il bottone). Prima fa il blur del
    // campo attivo così i componenti che committano onBlur (es. InputDecimal)
    // aggiornano lo stato, poi invia al tick successivo. Non intercetta textarea
    // (a capo), select/button (nativo). I ConfirmModal non hanno input né form,
    // quindi l'Invio non li attiva: nessuna conferma accidentale.
    if (e.key === 'Enter') {
      const t = e.target as HTMLElement;
      if (t.tagName !== 'INPUT') return;
      e.preventDefault();
      t.blur();
      const form = containerRef.current?.querySelector('form');
      if (form) setTimeout(() => form.requestSubmit(), 0);
    }
  };

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-container"
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="modal-header">
          <h2 className="modal-title" id={titleId}>{title}</h2>
          <button
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Chiudi"
            type="button"
          >
            <X size={18} />
          </button>
        </div>

        <div className="modal-content">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}
