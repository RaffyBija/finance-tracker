import { useState } from 'react';
import { Plus, ArrowLeftRight, CalendarClock } from 'lucide-react';
import TransactionModal from '../../transactions/TransactionModal';
import TransferModal from '../../transactions/TransferModal';
import PlannedFormModal from '../../planned/PlannedFormModal';
import { useCategories } from '../../../hooks/useCategories';

// Widget "Azioni rapide" — apre al volo i form più usati da qualsiasi punto della dashboard.
export default function QuickActionsWidget() {
  const { data: categories = [] } = useCategories('ALL');
  const [showTransaction, setShowTransaction] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [showPlanned, setShowPlanned] = useState(false);

  return (
    <div className="card quick-actions">
      <div className="card-header">
        <h2 className="card-header-title">Azioni rapide</h2>
      </div>
      <div className="quick-actions-grid">
        <button
          type="button"
          className="quick-action-btn"
          onClick={() => setShowTransaction(true)}
        >
          <span className="quick-action-icon quick-action-icon-income">
            <Plus size={18} />
          </span>
          <span className="quick-action-label">Nuova transazione</span>
        </button>

        <button
          type="button"
          className="quick-action-btn"
          onClick={() => setShowTransfer(true)}
        >
          <span className="quick-action-icon quick-action-icon-transfer">
            <ArrowLeftRight size={18} />
          </span>
          <span className="quick-action-label">Trasferimento</span>
        </button>

        <button
          type="button"
          className="quick-action-btn"
          onClick={() => setShowPlanned(true)}
        >
          <span className="quick-action-icon quick-action-icon-planned">
            <CalendarClock size={18} />
          </span>
          <span className="quick-action-label">Nuova pianificata</span>
        </button>
      </div>

      <TransactionModal
        isOpen={showTransaction}
        categories={categories}
        editingTransactionData={null}
        onClose={() => setShowTransaction(false)}
        sentFeed={() => {}}
      />
      <TransferModal
        isOpen={showTransfer}
        editingTransfer={null}
        onClose={() => setShowTransfer(false)}
      />
      <PlannedFormModal
        isOpen={showPlanned}
        editingItem={null}
        categories={categories}
        onClose={() => setShowPlanned(false)}
        onSuccess={() => setShowPlanned(false)}
      />
    </div>
  );
}
