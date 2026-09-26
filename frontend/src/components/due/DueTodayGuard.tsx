import { useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { usePending } from '../../contexts/PendingContext';
import { useAccounts } from '../../hooks/useAccounts';
import { useDailyGate } from '../../hooks/useDailyGate';
import { buildDueEntries } from './dueEntries';
import DueTodayModal from './DueTodayModal';

const DUE_CHECK_KEY = 'dueTodayCheck';

/**
 * Popup unico delle scadenze di oggi/arretrate: ricorrenti, pianificate, rate e
 * addebiti carta. Una volta al giorno ("Salta oggi" vale per tutta la giornata).
 * I dati arrivano da PendingContext (le stesse query dei badge): popup e badge
 * non possono divergere.
 */
export default function DueTodayGuard() {
  const { isDismissed, dismiss } = useDailyGate(DUE_CHECK_KEY);
  const { recurringDueData, plannedDueData, installmentDueData, isLoading, isError } = usePending();
  const { data: accounts = [] } = useAccounts();
  const today = format(new Date(), 'yyyy-MM-dd');

  const entries = useMemo(
    () => buildDueEntries({
      recurring: recurringDueData,
      planned: plannedDueData,
      installments: installmentDueData,
      accounts,
      today,
    }),
    [recurringDueData, plannedDueData, installmentDueData, accounts, today],
  );

  // Controllo in background senza UI propria: un errore non deve passare in silenzio.
  useEffect(() => {
    if (isError) {
      console.error('Controllo scadenze fallito: il promemoria potrebbe essere incompleto.');
    }
  }, [isError]);

  if (isDismissed || isLoading || entries.length === 0) return null;

  return <DueTodayModal entries={entries} onDismiss={dismiss} />;
}
