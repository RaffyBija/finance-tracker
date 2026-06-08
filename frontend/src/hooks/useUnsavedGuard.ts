import { useRef, useState } from 'react';

/**
 * Guardia "modifiche non salvate" per i form modali.
 *
 * Cattura uno snapshot dello stato all'apertura (`capture`, da chiamare
 * nell'effect di apertura con lo stesso oggetto passato a setFormData, così lo
 * snapshot non resta indietro di un render). Se alla chiusura lo stato differisce
 * dallo snapshot, `requestClose` apre una conferma invece di scartare in silenzio;
 * se è pulito, chiude subito. La conferma usa il ConfirmModal dell'app, coerente
 * coi delete.
 */
export function useUnsavedGuard<T>(current: T, onClose: () => void) {
  const snapshot = useRef('');
  const [confirming, setConfirming] = useState(false);

  const capture = (initial: T) => {
    snapshot.current = JSON.stringify(initial);
    setConfirming(false);
  };

  const isDirty = JSON.stringify(current) !== snapshot.current;

  const requestClose = () => {
    if (isDirty) setConfirming(true);
    else onClose();
  };

  const confirmDiscard = () => {
    setConfirming(false);
    onClose();
  };

  const dismissConfirm = () => setConfirming(false);

  return { capture, requestClose, confirming, confirmDiscard, dismissConfirm };
}
