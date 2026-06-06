// Formattazione valuta — UNICO punto di verità per tutta l'app.
// Oggi: euro, locale it-IT. In futuro la valuta/locale arriveranno dalle
// impostazioni del profilo utente e passeranno solo da qui: cambiando questi
// due valori (o leggendoli da un contesto) il formato si propaga ovunque,
// senza toccare i singoli componenti. Si usa Intl.NumberFormat, già
// currency-agnostic: simbolo, posizione e decimali corretti per ogni valuta.
const LOCALE = 'it-IT';
const CURRENCY = 'EUR';

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat(LOCALE, { style: 'currency', currency: CURRENCY }).format(amount);
}

// Importo di una transazione con segno esplicito (+/−), formattato sul valore
// assoluto: il segno resta coerente con icona e colore della riga.
export function formatSignedCurrency(amount: number, type: 'INCOME' | 'EXPENSE'): string {
  const sign = type === 'INCOME' ? '+' : '−';
  return `${sign}${formatCurrency(Math.abs(amount))}`;
}
