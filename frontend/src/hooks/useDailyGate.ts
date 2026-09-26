import { useCallback, useState } from 'react';

// Data locale YYYY-MM-DD: toISOString() è UTC e tra mezzanotte e le 2 (ora
// italiana) restituirebbe il giorno prima, riaprendo un promemoria già saltato.
const localDateKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const readGate = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

/**
 * Gate "una volta al giorno" per i popup promemoria (ricorrenti, addebito CC).
 *
 * Il dismiss è ricordato sia in stato React (vale per la sessione anche se
 * localStorage non è disponibile) sia in localStorage (vale per tutta la giornata
 * e tra le schede). `isDismissed` rilegge localStorage a ogni render: un refetch
 * dei dati NON può riaprire un popup già saltato oggi.
 */
export function useDailyGate(key: string) {
  const today = localDateKey();
  const [dismissedOn, setDismissedOn] = useState<string | null>(null);

  const isDismissed = dismissedOn === today || readGate(key) === today;

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(key, today);
    } catch {
      /* localStorage non disponibile: resta il dismiss in memoria per la sessione */
    }
    setDismissedOn(today);
  }, [key, today]);

  return { isDismissed, dismiss };
}
