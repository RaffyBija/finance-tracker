import "../../styles/Modal.css";
import MyAlert from "./MyAlert";
import type { AlertPopUp } from '../../types/index';
import { X } from 'lucide-react';

interface BaseModalProps {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactElement;
  feedAlert: AlertPopUp;
}

export default function BaseModal({
  isOpen,
  title,
  onClose,
  children,
  feedAlert,
}: BaseModalProps) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>

      {/* Alert feedback — fixed, sopra tutto, visibile sempre */}
      <div className="modal-alert-wrapper">
        <MyAlert AlertConfig={feedAlert} />
      </div>

      <div
        className="modal-container"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header con titolo e pulsante chiudi */}
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

    </div>
  );
}