import prisma from './prisma';

// ── Ricorrenti a importo variabile (es. stipendio) ───────────────────────────
//
//   `amount` è una STIMA: a ogni registrazione l'utente conferma l'importo reale,
//   poi la stima diventa la mediana degli ultimi importi confermati. La mediana
//   (e non la media) ignora un mese anomalo (tredicesima, conguaglio).

export const VARIABLE_ESTIMATE_WINDOW = 3;
// Movimenti creati a meno di così l'uno dall'altro appartengono alla stessa
// registrazione (stessa $transaction: arretrati + scadenza corrente).
const SAME_RUN_MS = 5_000;
// Movimenti letti per ricostruire le ultime registrazioni (arretrati inclusi).
const HISTORY_TAKE = 60;

// Funzione PURA: mediana dei primi `window` importi (già ordinati dal più recente),
// arrotondata al centesimo. null se non ci sono importi.
export function medianOfRecent(amounts: number[], window = VARIABLE_ESTIMATE_WINDOW): number | null {
  const recent = amounts.slice(0, window).filter((a) => Number.isFinite(a)).sort((a, b) => a - b);
  if (recent.length === 0) return null;
  const mid = Math.floor(recent.length / 2);
  const median = recent.length % 2 ? recent[mid] : (recent[mid - 1] + recent[mid]) / 2;
  return Math.round(median * 100) / 100;
}

type RecurringTx = { amount: number; date: Date; createdAt: Date };

// Funzione PURA: importi CONFERMATI dall'utente, dal più recente. Una registrazione
// crea gli arretrati alla stima più la scadenza corrente (data più recente) con
// l'importo confermato: per ogni registrazione conta solo quest'ultima.
// ponytail: le registrazioni si riconoscono dalla vicinanza di createdAt (niente
// flag sulla Transaction); un flag `amountConfirmed` se servisse più precisione.
export function confirmedAmounts(txs: RecurringTx[]): number[] {
  const byCreation = [...txs].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const runs: RecurringTx[][] = [];
  for (const t of byCreation) {
    const run = runs[runs.length - 1];
    if (run && t.createdAt.getTime() - run[run.length - 1].createdAt.getTime() <= SAME_RUN_MS) run.push(t);
    else runs.push([t]);
  }
  return runs
    .map((run) => run.reduce((latest, t) => (t.date > latest.date ? t : latest)))
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .map((t) => t.amount);
}

// Aggiorna la stima delle ricorrenti variabili indicate, dai loro movimenti reali.
// Da chiamare DOPO la registrazione (fuori da $transaction). Best effort: i movimenti
// sono già salvati, un errore qui non deve trasformarsi in un 500.
export async function refreshVariableEstimates(recurringIds: string[]): Promise<void> {
  try {
    for (const id of recurringIds) {
      const txs = await prisma.transaction.findMany({
        where: { fromRecurringId: id },
        select: { amount: true, date: true, createdAt: true },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        take: HISTORY_TAKE,
      });
      const estimate = medianOfRecent(confirmedAmounts(txs.map((t) => ({ ...t, amount: Number(t.amount) }))));
      if (estimate !== null && estimate > 0) {
        await prisma.recurringTransaction.update({ where: { id }, data: { amount: estimate } });
      }
    }
  } catch (error) {
    console.error('Refresh variable estimates error:', error);
  }
}
