import type { TransactionItem } from '../types';

// Etichetta compatta delle categorie di una transazione divisa (split):
// "Bar · Fumo", oppure "Bar · Fumo +2" quando le categorie superano `max`.
// Restituisce stringa vuota se la transazione non è divisa.
export function splitCategoriesLabel(
  items: TransactionItem[] | undefined | null,
  max = 2,
): string {
  if (!items || items.length === 0) return '';
  const names = items.map((i) => i.category?.name || 'Senza categoria');
  if (names.length <= max) return names.join(' · ');
  return `${names.slice(0, max).join(' · ')} +${names.length - max}`;
}
