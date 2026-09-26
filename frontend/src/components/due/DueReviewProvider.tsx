import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { format } from 'date-fns';
import { usePending } from '../../contexts/PendingContext';
import { useAccounts } from '../../hooks/useAccounts';
import { useDailyGate } from '../../hooks/useDailyGate';
import { buildDueEntries, type DueKind } from './dueEntries';
import DueTodayModal from './DueTodayModal';

const DUE_CHECK_KEY = 'dueTodayCheck';

interface DueReviewContextValue {
  /** Apre il popup a mano (es. dal banner di una lista), filtrato sui tipi indicati. */
  openDueReview: (kinds: DueKind[]) => void;
}

const DueReviewContext = createContext<DueReviewContextValue>({ openDueReview: () => {} });

export const useDueReview = () => useContext(DueReviewContext);

/**
 * Popup unico delle scadenze di oggi/arretrate: ricorrenti, pianificate, rate e
 * addebiti carta.
 * - Automatico: una volta al giorno ("Salta oggi" vale per tutta la giornata).
 * - Manuale: i banner delle liste lo aprono filtrato sul proprio tipo; chiuderlo
 *   non tocca il gate giornaliero.
 * I dati arrivano da PendingContext (le stesse query dei badge): popup, banner e
 * badge non possono divergere.
 */
export default function DueReviewProvider({ children }: { children: ReactNode }) {
  const { isDismissed, dismiss } = useDailyGate(DUE_CHECK_KEY);
  const { recurringDueData, plannedDueData, installmentDueData, isLoading, isError } = usePending();
  const { data: accounts = [] } = useAccounts();
  const [manualKinds, setManualKinds] = useState<DueKind[] | null>(null);
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

  const openDueReview = useCallback((kinds: DueKind[]) => setManualKinds(kinds), []);
  const contextValue = useMemo(() => ({ openDueReview }), [openDueReview]);

  const manualEntries = manualKinds ? entries.filter((e) => manualKinds.includes(e.kind)) : [];
  const showManual = manualEntries.length > 0;
  const showAuto = !showManual && !isDismissed && !isLoading && entries.length > 0;

  return (
    <DueReviewContext.Provider value={contextValue}>
      {children}
      {showManual && (
        <DueTodayModal key="manual" manual entries={manualEntries} onDismiss={() => setManualKinds(null)} />
      )}
      {showAuto && <DueTodayModal key="auto" entries={entries} onDismiss={dismiss} />}
    </DueReviewContext.Provider>
  );
}
