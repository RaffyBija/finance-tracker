import "../../styles/Modal.css";
import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';
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

  // Auto-focus sul primo campo all'apertura — SOLO su dispositivi con puntatore
  // preciso (desktop/laptop), così su mobile/tablet non si apre la tastiera.
  useEffect(() => {
    if (!isOpen) return;
    if (!window.matchMedia('(pointer: fine)').matches) return;
    const first = containerRef.current?.querySelector<HTMLElement>(
      '.modal-content input:not([type="hidden"]), .modal-content select, .modal-content textarea',
    );
    first?.focus();
  }, [isOpen]);

  if (!isOpen) return null;

  // Invio = invia il form (senza dover cliccare il bottone). Prima fa il blur del
  // campo attivo così componenti che committano onBlur (es. InputDecimal)
  // aggiornano lo stato, poi invia al tick successivo. Non intercetta textarea
  // (a capo), select/button (comportamento nativo). I ConfirmModal non hanno input
  // né form, quindi l'Invio non li attiva: nessuna cancellazione accidentale.
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter') return;
    const t = e.target as HTMLElement;
    if (t.tagName !== 'INPUT') return;
    e.preventDefault();
    t.blur();
    const form = containerRef.current?.querySelector('form');
    if (form) setTimeout(() => form.requestSubmit(), 0);
  };

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-container"
        ref={containerRef}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="modal-header">
          <h2 className="modal-title">{title}</h2>
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
