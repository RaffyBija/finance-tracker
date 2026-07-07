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
// Conteggio dei modali che tracciano il visualViewport (stesso principio di
// modalOpenCount): le CSS var --modal-vvh/--modal-vvt vengono rimosse solo
// quando si chiude l'ULTIMO modale, non da ogni cleanup.
let viewportTrackers = 0;

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

  // Tastiera mobile: `dvh`/`100%` non si accorciano quando si apre la tastiera
  // su iOS, così la sheet a tutto schermo finirebbe dietro la tastiera. Tracciamo
  // l'area reale visibile del visualViewport in due CSS var usate da Modal.css:
  // `--modal-vvh` (altezza: la sheet si accorcia sopra la tastiera) e
  // `--modal-vvt` (offsetTop: su iOS la tastiera non solo accorcia il viewport,
  // lo SPOSTA — senza compensare l'offset la sheet resta ancorata al layout
  // viewport e finisce con l'header fuori schermo e i bottoni dietro la tastiera).
  // Le var sono globali (:root) e condivise dai modali impilati (es. ConfirmModal
  // sopra un form): come per lo scroll-lock, il conteggio fa sì che solo l'ultimo
  // modale a chiudersi le rimuova — altrimenti la sheet sottostante perderebbe
  // la compensazione tastiera proprio mentre è ancora aperta.
  useEffect(() => {
    if (!isOpen) return;
    const vv = window.visualViewport;
    if (!vv) return;

    const sync = () => {
      const s = document.documentElement.style;
      s.setProperty('--modal-vvh', `${vv.height}px`);
      s.setProperty('--modal-vvt', `${vv.offsetTop}px`);
    };
    sync();
    viewportTrackers += 1;
    vv.addEventListener('resize', sync);
    vv.addEventListener('scroll', sync);

    return () => {
      vv.removeEventListener('resize', sync);
      vv.removeEventListener('scroll', sync);
      viewportTrackers = Math.max(0, viewportTrackers - 1);
      if (viewportTrackers === 0) {
        document.documentElement.style.removeProperty('--modal-vvh');
        document.documentElement.style.removeProperty('--modal-vvt');
      }
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
