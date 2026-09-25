import type { CreateTransactionDTO, Transaction } from '../types';

// Confronta la transazione originale col form per decidere se salvare o meno.
// Deve includere OGNI campo che il salvataggio può cambiare: dimenticarne uno
// (es. accountId) fa saltare la chiamata API in modifica, lasciando saldo e
// conto disallineati senza errore visibile.
export function isTransactionUnchanged(
  original: Transaction,
  formData: CreateTransactionDTO,
  wasSplit: boolean,
  splitMode: boolean,
): boolean {
  return (
    !splitMode &&
    !wasSplit &&
    original.amount === formData.amount &&
    original.type === formData.type &&
    original.description === formData.description &&
    original.date.split('T')[0] === formData.date &&
    original.categoryId === formData.categoryId &&
    (original.accountId ?? '') === (formData.accountId ?? '')
  );
}
