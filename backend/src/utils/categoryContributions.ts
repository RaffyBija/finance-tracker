// Espansione di una transazione nelle sue "contribuzioni per categoria".
//
// Una transazione è semplice (categoryId sul padre, nessuna riga) oppure divisa
// (split: categoryId padre = null, >= 2 righe in `items` con somma = amount padre).
// Gli aggregati per categoria — pie, trend, forecast — devono accreditare l'importo
// alla categoria giusta in entrambi i casi: questo helper unifica la logica così i
// controller non la duplicano. Saldi, cicli CC e proiezioni usano l'amount totale
// e NON passano da qui.

// Forma minima richiesta da una categoria collegata (può arrivarne di più ricche).
type CategoryLike = { id: string; name: string; color: string | null; icon: string | null };

// Forma minima di una riga/transazione: amount Prisma Decimal o number, categoria opzionale.
type AmountLike = number | { toString(): string };

interface TransactionItemLike {
  amount: AmountLike;
  categoryId: string | null;
  category?: CategoryLike | null;
}

interface TransactionLike {
  amount: AmountLike;
  categoryId: string | null;
  category?: CategoryLike | null;
  items?: TransactionItemLike[] | null;
}

export interface CategoryLine {
  categoryId: string | null;
  amount: number;
  category?: CategoryLike | null;
}

const toNumber = (v: AmountLike): number =>
  typeof v === 'number' ? v : Number(v.toString());

// Restituisce una riga per ogni contribuzione di categoria della transazione:
// - transazione divisa (items non vuoto) → una riga per ciascun item;
// - transazione semplice → una sola riga con la categoria (eventualmente null) del padre.
export function expandToCategoryLines(tx: TransactionLike): CategoryLine[] {
  if (tx.items && tx.items.length > 0) {
    return tx.items.map((item) => ({
      categoryId: item.categoryId,
      amount: toNumber(item.amount),
      category: item.category ?? null,
    }));
  }
  return [
    {
      categoryId: tx.categoryId,
      amount: toNumber(tx.amount),
      category: tx.category ?? null,
    },
  ];
}
