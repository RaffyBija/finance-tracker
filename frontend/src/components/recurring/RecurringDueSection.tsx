import { Zap } from 'lucide-react';
import { usePending } from '../../contexts/PendingContext';
import { useExecuteRecurring } from '../../hooks/useRecurringTransactions';
import { useToast } from '../../contexts/ToastContext';

export default function RecurringDueSection() {
  const { recurringDueData, recurringDueCount } = usePending();
  const executeMutation = useExecuteRecurring();
  const toast = useToast();

  if (!recurringDueData || recurringDueCount === 0) return null;

  const allIds = [
    ...recurringDueData.dueToday.map((i) => i.id),
    ...recurringDueData.overdue.map((i) => i.id),
  ];

  const handleExecuteAll = async () => {
    try {
      const result = await executeMutation.mutateAsync(allIds);
      const n = result.count;
      toast.success(`${n} transazion${n === 1 ? 'e creata' : 'i create'} con successo`);
    } catch {
      toast.error('Errore nella creazione delle transazioni');
    }
  };

  return (
    <div className="pending-banner">
      <span className="pending-banner-label">
        <Zap size={14} />
        {recurringDueCount === 1
          ? '1 ricorrente da eseguire'
          : `${recurringDueCount} ricorrenti da eseguire`}
      </span>
      <button
        className="btn btn-primary btn-sm"
        onClick={handleExecuteAll}
        disabled={executeMutation.isPending}
      >
        {executeMutation.isPending ? 'Creazione...' : 'Esegui tutte'}
      </button>
    </div>
  );
}
