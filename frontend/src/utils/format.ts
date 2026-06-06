// Formattazione valuta — logica pura, parametrizzata per valuta.
// La valuta dell'utente arriva dal profilo (AuthContext): nei componenti usa
// l'hook `useFormatCurrency()` (reattivo al cambio), che lega queste funzioni
// alla valuta corrente. Il default 'EUR' copre eventuali usi fuori da React.
// Intl.NumberFormat è currency-agnostic: simbolo, posizione e decimali corretti
// per ogni valuta; il locale di formattazione è derivato dalla valuta.
import { localeForCurrency } from './currency';

export function formatCurrency(amount: number, currency = 'EUR'): string {
  return new Intl.NumberFormat(localeForCurrency(currency), {
    style: 'currency',
    currency,
  }).format(amount);
}

// Importo di una transazione con segno esplicito (+/−), formattato sul valore
// assoluto: il segno resta coerente con icona e colore della riga.
export function formatSignedCurrency(
  amount: number,
  type: 'INCOME' | 'EXPENSE',
  currency = 'EUR',
): string {
  const sign = type === 'INCOME' ? '+' : '−';
  return `${sign}${formatCurrency(Math.abs(amount), currency)}`;
}
