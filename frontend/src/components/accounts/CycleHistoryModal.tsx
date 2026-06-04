import BaseModal from '../layout/ModalBase';
import CycleHistoryList from './CycleHistoryList';
import type { Account } from '../../types';

interface CycleHistoryModalProps {
  isOpen: boolean;
  account: Account | null;
  onClose: () => void;
}

export default function CycleHistoryModal({ isOpen, account, onClose }: CycleHistoryModalProps) {
  if (!isOpen || !account) return null;

  return (
    <BaseModal isOpen={isOpen} title={`Cicli di fatturazione · ${account.name}`} onClose={onClose}>
      <div className="modal-form">
        <CycleHistoryList accountId={account.id} enabled={isOpen} billingDay={account.billingDay} />

        <div className="form-actions">
          <button type="button" onClick={onClose} className="btn btn-ghost btn-md">
            Chiudi
          </button>
        </div>
      </div>
    </BaseModal>
  );
}
