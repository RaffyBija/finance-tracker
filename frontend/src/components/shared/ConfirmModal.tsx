import BaseModal from '../layout/ModalBase';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  confirmClassName?: string;
  isPending?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel = 'Elimina',
  confirmClassName = 'btn btn-danger btn-md',
  isPending = false,
  onConfirm,
  onClose,
}: ConfirmModalProps) {
  return (
    <BaseModal isOpen={isOpen} title={title} onClose={onClose}>
      <div className="modal-form">
        <p className="recurring-due-subtitle" style={{ fontSize: '0.9375rem', color: '#334155' }}>
          {message}
        </p>
        <div className="form-actions">
          <button type="button" onClick={onClose} className="btn btn-ghost btn-md" disabled={isPending}>
            Annulla
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className={confirmClassName}
          >
            {isPending ? 'In corso...' : confirmLabel}
          </button>
        </div>
      </div>
    </BaseModal>
  );
}
