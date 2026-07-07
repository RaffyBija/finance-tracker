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

// Lock dello scroll del body a conteggio: con modali impilati (es. la conferma
// "scarta modifiche" sopra un form) solo l'ultimo a chiudersi ripristina
// l'overflow. Senza il conteggio l'ordine di cleanup poteva lasciare il body
// bloccato su `hidden`.
let modalOpenCount = 0;
let savedBodyOverflow = '';
let savedScrollY = 0;
let fixedLockApplied = false;

function lockBodyScroll() {
  if (modalOpenCount === 0) {
    savedBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // iOS Safari ignora `overflow: hidden` sul body: la pagina dietro al modal
    // continua a scrollare e, all'apertura della tastiera, Safari trascina il
    // layout viewport. L'unico lock affidabile su WebKit touch è il body
    // `position: fixed` con compensazione dello scroll (ripristinato in unlock).
    // Solo su puntatore coarse: sul desktop cambierebbe la scrollbar per nulla.
    if (window.matchMedia('(pointer: coarse)').matches) {
      savedScrollY = window.scrollY;
      const b = document.body.style;
      b.position = 'fixed';
      b.top = `-${savedScrollY}px`;
      b.left = '0';
      b.right = '0';
      b.width = '100%';
      fixedLockApplied = true;
    }
  }
  modalOpenCount += 1;
}

function unlockBodyScroll() {
  modalOpenCount = Math.max(0, modalOpenCount - 1);
  if (modalOpenCount === 0) {
    document.body.style.overflow = savedBodyOverflow;
    if (fixedLockApplied) {
      const b = document.body.style;
      b.position = '';
      b.top = '';
      b.left = '';
      b.right = '';
      b.width = '';
      fixedLockApplied = false;
      window.scrollTo(0, savedScrollY);
    }
  }
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
    lockBodyScroll();

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
      unlockBodyScroll();
      previouslyFocused?.focus?.();
    };
  }, [isOpen]);

  // NOTA tastiera mobile (deciso 2026-07-07 su feedback da iPhone reale):
  // NON accoppiamo l'altezza della sheet al visualViewport. La strategia
  // "restringi la sheet a visualViewport.height/offsetTop" (--modal-vvh/-vvt)
  // è stata provata due volte e su Safari iOS reale produce un modal compresso
  // e disallineato. Comportamento attuale, come le app native: la sheet resta
  // a tutta pagina, la tastiera la copre in overlay e iOS scrolla da sé il
  // campo focalizzato dentro `.modal-content` (che è scrollabile). Su Android
  // ci pensa `interactive-widget=resizes-content` nel meta viewport.

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
