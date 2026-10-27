import type { Budget, BudgetStatus } from '../types';

export const round2 = (n: number) => Math.round(n * 100) / 100;

/** Stato del budget: dal backend, altrimenti derivato dalle date (risposta vecchia). */
export function budgetStatus(b: Budget): BudgetStatus {
  if (b.status) return b.status;
  const now = Date.now();
  if (new Date(b.startDate).getTime() > now) return 'upcoming';
  if (b.endDate && new Date(b.endDate).getTime() < now) return 'expired';
  return 'active';
}

export const isActiveBudget = (b: Budget) => budgetStatus(b) === 'active';

/** Budget effettivo del periodo (base + riporto). */
export const effectiveAmount = (b: Budget) => b.effectiveAmount ?? Number(b.amount);

/**
 * Quanto resta ancora da spendere su un budget. Mai negativo: uno sforamento è già uscito
 * dalla disponibilità, non "libera" altri soldi.
 */
export const budgetLeft = (b: Budget) => Math.max(0, b.remaining ?? effectiveAmount(b) - (b.spent ?? 0));

/**
 * Budget di categoria attivi dello STESSO periodo del piano, senza sovrapposizioni: il budget
 * globale resta fuori (è un tetto complessivo) e, se esiste un budget sulla macro, quello su
 * una sua sotto-categoria non si somma (la macro ne contiene già la spesa).
 */
export function planBudgets(budgets: Budget[], period: Budget['period']): Budget[] {
  const same = budgets.filter((b) => isActiveBudget(b) && !!b.categoryId && b.period === period);
  const ids = new Set(same.map((b) => b.categoryId));
  return same.filter((b) => !(b.category?.parentId && ids.has(b.category.parentId)));
}

/**
 * Ritmo del periodo: frazione di periodo trascorsa (0..1) e proiezione di fine periodo
 * al ritmo attuale. `projected` è null quando non è affidabile/utile (periodo non in
 * corso, nessuna spesa, troppo presto per estrapolare).
 */
export function budgetPace(b: Budget): { elapsed: number | null; projected: number | null } {
  if (!b.periodStart || !b.periodEnd) return { elapsed: null, projected: null };
  const start = new Date(b.periodStart).getTime();
  // periodEnd arriva dal backend a fine giornata (23:59:59.999): la finestra finisce 1 ms dopo.
  const end = new Date(b.periodEnd).getTime() + 1;
  const now = Date.now();
  if (!(end > start) || now < start || now >= end) return { elapsed: null, projected: null };
  const elapsed = (now - start) / (end - start);
  const spent = b.spent ?? 0;
  // La spesa variabile è a scatti (es. la spesa settimanale): sotto il 40% del periodo
  // l'estrapolazione lineare darebbe cifre fuorvianti.
  const projected = spent > 0 && elapsed >= 0.4 ? round2(spent / elapsed) : null;
  return { elapsed, projected };
}

/**
 * Scala proporzionalmente i tetti se la loro somma supera lo spendibile (stessa regola
 * del backend, così lo slider del risparmio resta reattivo senza rifare la query).
 */
export function scaleCaps(
  raw: number[],
  spendable: number,
): { caps: number[]; factor: number; scaled: boolean } {
  const total = raw.reduce((s, v) => s + v, 0);
  const room = Math.max(0, spendable);
  if (total <= room) return { caps: raw, factor: 1, scaled: false };
  const factor = room / total;
  // Per difetto al centesimo, come il backend: Σ tetti non sfora lo spendibile.
  return { caps: raw.map((v) => Math.max(0, Math.floor(v * factor * 100) / 100)), factor, scaled: true };
}

/**
 * Il form di modifica ha cambiato davvero qualcosa rispetto al budget salvato?
 * "Attivo da" vuoto non conta: in modifica significa "lascia la data com'è".
 */
export function budgetFormChanged(
  form: { name: string; amount: number; categoryId?: string; period: string; rollover?: string; startDate?: string; endDate?: string },
  item: Budget,
): boolean {
  const day = (d?: string) => (d ? d.split('T')[0] : '');
  return (
    form.name.trim() !== item.name.trim() ||
    Number(form.amount) !== Number(item.amount) ||
    (form.categoryId || '') !== (item.categoryId || '') ||
    form.period !== item.period ||
    (form.rollover ?? 'NONE') !== (item.rollover ?? 'NONE') ||
    (!!form.startDate && day(form.startDate) !== day(item.startDate)) ||
    day(form.endDate) !== day(item.endDate)
  );
}

/** Data locale YYYY-MM-DD (mai toISOString: in UTC scavalla il giorno). */
export function toLocalDateString(d: Date = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** "1 giorno" / "5 giorni" */
export const daysLabel = (n: number) => `${n} ${n === 1 ? 'giorno' : 'giorni'}`;
