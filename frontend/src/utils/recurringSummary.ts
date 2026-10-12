import type { Frequency, TransactionType } from '../types';

/** Campi minimi richiesti: l'helper non dipende dal resto di RecurringTransaction. */
export interface RecurringSummaryItem {
  amount: number | string;
  type: TransactionType;
  frequency: Frequency;
  isActive: boolean;
}

export interface RecurringSummary {
  /** Entrate mensili equivalenti. */
  income: number;
  /** Uscite mensili equivalenti (positive). */
  expense: number;
  /** income - expense. */
  net: number;
  /** Equivalente annuo del netto (net × 12). */
  netYearly: number;
  /** Numero di ricorrenti attive considerate. */
  count: number;
}

/** Quante occorrenze in un mese medio, per frequenza. */
const PER_MONTH: Record<Frequency, number> = {
  WEEKLY: 52 / 12,
  MONTHLY: 1,
  YEARLY: 1 / 12,
};

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Totale mensile equivalente delle ricorrenti ATTIVE (le disattivate sono escluse). */
export function summarizeRecurring(items: RecurringSummaryItem[]): RecurringSummary {
  let income = 0;
  let expense = 0;
  let count = 0;
  for (const it of items) {
    if (!it.isActive) continue;
    const monthly = Number(it.amount) * PER_MONTH[it.frequency];
    if (!Number.isFinite(monthly)) continue;
    count++;
    if (it.type === 'INCOME') income += monthly;
    else expense += monthly;
  }
  income = round2(income);
  expense = round2(expense);
  const net = round2(income - expense);
  return { income, expense, net, netYearly: round2(net * 12), count };
}
