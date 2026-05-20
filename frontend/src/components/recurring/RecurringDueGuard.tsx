import { useRecurringDue } from '../../hooks/useRecurringTransactions';
import RecurringDueModal from './RecurringDueModal';

export default function RecurringDueGuard() {
  const { data, isOpen, dismiss } = useRecurringDue();
  return <RecurringDueModal isOpen={isOpen} data={data} onDismiss={dismiss} />;
}
