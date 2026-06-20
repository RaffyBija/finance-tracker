import { useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  formatCurrency as formatCurrencyWith,
  formatCurrencyAxis as formatCurrencyAxisWith,
  formatSignedCurrency as formatSignedCurrencyWith,
  formatPercent as formatPercentWith,
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

  const formatCurrencyAxis = useCallback(
    (amount: number) => formatCurrencyAxisWith(amount, currency),
    [currency],
  );

  const formatSignedCurrency = useCallback(
    (amount: number, type: 'INCOME' | 'EXPENSE') => formatSignedCurrencyWith(amount, type, currency),
    [currency],
  );

  const formatPercent = useCallback(
    (value: number, maximumFractionDigits = 1) => formatPercentWith(value, currency, maximumFractionDigits),
    [currency],
  );

  return { formatCurrency, formatCurrencyAxis, formatSignedCurrency, formatPercent, currency };
}
