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

// Formato per i tick degli assi dei grafici: senza centesimi (i ",00" sono
// rumore di chrome su un asse). La cifra esatta vive nel tooltip e nell'hero.
// Mantiene simbolo, posizione e separatori della valuta.
export function formatCurrencyAxis(amount: number, currency = 'EUR'): string {
  return new Intl.NumberFormat(localeForCurrency(currency), {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

// Percentuale formattata col locale della valuta dell'utente (separatori coerenti
// con gli importi accanto). Niente simbolo % qui: lo aggiunge il chiamante.
export function formatPercent(value: number, currency = 'EUR', maximumFractionDigits = 1): string {
  return new Intl.NumberFormat(localeForCurrency(currency), {
    maximumFractionDigits,
  }).format(value);
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
