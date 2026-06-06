import { useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  formatCurrency as formatCurrencyWith,
  formatSignedCurrency as formatSignedCurrencyWith,
} from '../utils/format';

/** Formattazione valuta legata alla preferenza dell'utente (AuthContext).
 *  Reattivo: cambiando la valuta nel profilo, ogni importo si riformatta.
 *  Default 'EUR' finché l'utente non è caricato. */
export function useFormatCurrency() {
  const { user } = useAuth();
  const currency = user?.currency ?? 'EUR';

  const formatCurrency = useCallback(
    (amount: number) => formatCurrencyWith(amount, currency),
    [currency],
  );

  const formatSignedCurrency = useCallback(
    (amount: number, type: 'INCOME' | 'EXPENSE') => formatSignedCurrencyWith(amount, type, currency),
    [currency],
  );

  return { formatCurrency, formatSignedCurrency, currency };
}
