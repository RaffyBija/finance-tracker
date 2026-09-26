import { useEffect } from 'react';
import { useRecurringDue } from '../../hooks/useRecurringTransactions';
import RecurringDueModal from './RecurringDueModal';

export default function RecurringDueGuard() {
  const { data, isOpen, dismiss, isError } = useRecurringDue();

  // retry:false + un solo mount per sessione: un fallimento qui silenzia il
  // promemoria ricorrenti per l'intera sessione, senza alcun segnale. Nessuna
  // UI dedicata (è un controllo in background, non un widget) — almeno un log
  // esplicito invece del silenzio totale.
  useEffect(() => {
    if (isError) {
      console.error('Controllo ricorrenti in scadenza fallito: il promemoria non verrà mostrato per questa sessione.');
    }
  }, [isError]);

  // key: il modal si rimonta all'apertura, così la selezione iniziale (tutte le
  // voci) è calcolata sui dati arrivati e non sul primo render con data=null.
  return <RecurringDueModal key={isOpen ? 'open' : 'closed'} isOpen={isOpen} data={data} onDismiss={dismiss} />;
}
