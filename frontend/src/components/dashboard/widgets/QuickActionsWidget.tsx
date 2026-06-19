import { useState } from 'react';
import { Plus, ArrowLeftRight, CalendarClock } from 'lucide-react';
import TransactionModal from '../../transactions/TransactionModal';
import TransferModal from '../../transactions/TransferModal';
import PlannedFormModal from '../../planned/PlannedFormModal';
import { useCategories } from '../../../hooks/useCategories';

// Barra azioni rapide: riga compatta icona+label, senza card né titolo.
// Apre al volo i form più usati da qualsiasi punto della dashboard.
export default function QuickActionsWidget() {
  const { data: categories = [] } = useCategories('ALL');
  const [showTransaction, setShowTransaction] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [showPlanned, setShowPlanned] = useState(false);

  return (
    <div className="quick-bar">
      <button type="button" className="quick-bar-btn" onClick={() => setShowTransaction(true)}>
        <Plus size={16} className="quick-bar-icon quick-bar-icon-income" />
        Transazione
      </button>
      <button type="button" className="quick-bar-btn" onClick={() => setShowTransfer(true)}>
        <ArrowLeftRight size={16} className="quick-bar-icon quick-bar-icon-transfer" />
        Trasferimento
      </button>
      <button type="button" className="quick-bar-btn" onClick={() => setShowPlanned(true)}>
        <CalendarClock size={16} className="quick-bar-icon quick-bar-icon-planned" />
        Pianificata
      </button>

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
