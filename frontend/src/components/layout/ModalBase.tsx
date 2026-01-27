// components/modal/BaseModal.tsx
import "../../styles/Modal.css";

import MyAlert from "./MyAlert";

import type {AlertPopUp} from '../../types/index'

interface BaseModalProps {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactElement;
  feedAlert: AlertPopUp
}

export default function BaseModal({
  isOpen,
  title,
  onClose,
  children,
  feedAlert
}: BaseModalProps) {
  if (!isOpen) return null;
  return (
    <>
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container">
        <div
          className="modal-content"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="modal-header">
            <h2 className="modal-title">{title}</h2>
          </div>

          {children}

        </div>
        <MyAlert
      AlertConfig={feedAlert}
    >
    </MyAlert>
        </div>
        
    </div>
    
    </>
  );
}
