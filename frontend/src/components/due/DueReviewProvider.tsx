import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { format } from 'date-fns';
import { usePending } from '../../contexts/PendingContext';
import { useAccounts } from '../../hooks/useAccounts';
import { useDailyGate } from '../../hooks/useDailyGate';
import { buildDueEntries, type DueEntry, type DueKind } from './dueEntries';
import DueTodayModal from './DueTodayModal';

const DUE_CHECK_KEY = 'dueTodayCheck';

interface DueReviewContextValue {
  /** Apre il popup a mano (es. dal banner di una lista), filtrato sui tipi indicati. */
  openDueReview: (kinds: DueKind[]) => void;
  /** Apre il popup su voci specifiche (click su una card: anche scadenze future o Sospesi). */
  openDueEntries: (entries: DueEntry[]) => void;
}

const DueReviewContext = createContext<DueReviewContextValue>({
  openDueReview: () => {},
  openDueEntries: () => {},
});

type ManualReview = { kinds: DueKind[] } | { entries: DueEntry[] };

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
  const [manual, setManual] = useState<ManualReview | null>(null);
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

  const openDueReview = useCallback((kinds: DueKind[]) => setManual({ kinds }), []);
  const openDueEntries = useCallback((list: DueEntry[]) => setManual({ entries: list }), []);
  const contextValue = useMemo(() => ({ openDueReview, openDueEntries }), [openDueReview, openDueEntries]);

  // Per tipo: voci live (spariscono al refetch dopo la registrazione).
  // Per voci specifiche: snapshot scelto dall'utente, tutte preselezionate.
  const manualEntries = !manual
    ? []
    : 'kinds' in manual
      ? entries.filter((e) => manual.kinds.includes(e.kind))
      : manual.entries;
  const showManual = manualEntries.length > 0;
  const showAuto = !showManual && !isDismissed && !isLoading && entries.length > 0;

  return (
    <DueReviewContext.Provider value={contextValue}>
      {children}
      {showManual && (
        <DueTodayModal
          key="manual"
          manual
          preselectAll={!!manual && 'entries' in manual}
          entries={manualEntries}
          onDismiss={() => setManual(null)}
        />
      )}
      {showAuto && <DueTodayModal key="auto" entries={entries} onDismiss={dismiss} />}
    </DueReviewContext.Provider>
  );
}
