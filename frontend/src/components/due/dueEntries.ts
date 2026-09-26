import { format } from 'date-fns';
import type {
  Account,
  InstallmentDueRata,
  PlannedTransaction,
  RecurringDueResponse,
  TransactionType,
} from '../../types';

export type DueKind = 'recurring' | 'planned' | 'installment' | 'cc';

export interface DueEntry {
  /** Chiave univoca nel popup (prefisso per tipo: gli id sono di tabelle diverse). */
  key: string;
  kind: DueKind;
  /** id della riga sorgente (ricorrente o pianificata/rata). */
  id: string;
  title: string;
  subtitle: string;
  amount: number;
  type: TransactionType;
  /** Data prevista, locale YYYY-MM-DD: è la data proposta per la registrazione. */
  scheduledDate: string;
  /** 0 = oggi, >0 = giorni di ritardo. */
  daysOverdue: number;
  /** Solo rate: piano di appartenenza (il pagamento è per piano). */
  planId?: string;
}

/** Giorni di ritardo entro cui una scadenza parte già selezionata nel popup. */
export const RECENT_DAYS = 7;

export const DUE_GROUPS: { kind: DueKind; label: string }[] = [
  { kind: 'cc', label: 'Addebiti carta' },
  { kind: 'recurring', label: 'Ricorrenti' },
  { kind: 'planned', label: 'Pianificate' },
  { kind: 'installment', label: 'Rate' },
];

/** Data locale YYYY-MM-DD di un ISO del backend (mai slice: sarebbe UTC). */
export const toLocalDay = (iso: string | Date): string => format(new Date(iso), 'yyyy-MM-dd');

const daysBetween = (fromDay: string, toDay: string): number => {
  const [fy, fm, fd] = fromDay.split('-').map(Number);
  const [ty, tm, td] = toDay.split('-').map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000);
};

interface BuildInput {
  recurring: RecurringDueResponse | undefined;
  planned: PlannedTransaction[];
  installments: InstallmentDueRata[];
  accounts: Account[];
  today: string;
}

/**
 * Unifica in un'unica lista le scadenze di oggi/arretrate di tutto lo Scadenzario.
 * Le pianificate con ccAccountId sono l'addebito di un ciclo CC: vanno nel gruppo
 * "Addebiti carta" e si registrano come una pianificata (addebito sul conto collegato).
 */
export function buildDueEntries({ recurring, planned, installments, accounts, today }: BuildInput): DueEntry[] {
  const accountName = new Map(accounts.map((a) => [a.id, a.name]));
  const entries: DueEntry[] = [];

  for (const r of [...(recurring?.dueToday ?? []), ...(recurring?.overdue ?? [])]) {
    const scheduledDate = toLocalDay(r.nextDueDate);
    entries.push({
      key: `r:${r.id}`,
      kind: 'recurring',
      id: r.id,
      title: r.description,
      subtitle: r.category?.name ?? 'Senza categoria',
      amount: Number(r.amount),
      type: r.type,
      scheduledDate,
      daysOverdue: Math.max(0, daysBetween(scheduledDate, today)),
    });
  }

  for (const p of planned) {
    if (!p.plannedDate) continue;
    const scheduledDate = toLocalDay(p.plannedDate);
    const isCc = !!p.ccAccountId;
    const bank = p.account?.name ?? (p.accountId ? accountName.get(p.accountId) : undefined);
    entries.push({
      key: `p:${p.id}`,
      kind: isCc ? 'cc' : 'planned',
      id: p.id,
      title: p.description,
      subtitle: isCc
        ? bank ? `Addebito su ${bank}` : 'Addebito carta di credito'
        : p.category?.name ?? 'Senza categoria',
      amount: Number(p.amount),
      type: p.type,
      scheduledDate,
      daysOverdue: Math.max(0, daysBetween(scheduledDate, today)),
    });
  }

  for (const rata of installments) {
    if (!rata.plannedDate) continue;
    const scheduledDate = toLocalDay(rata.plannedDate);
    entries.push({
      key: `i:${rata.id}`,
      kind: 'installment',
      id: rata.id,
      // description = "Titolo piano — rata X/Y": dice quale rata si sta registrando.
      title: rata.description || rata.plan.title,
      subtitle: rata.counterparty ? `Piano a rate · ${rata.counterparty}` : 'Piano a rate',
      amount: Number(rata.amount),
      type: rata.type,
      scheduledDate,
      daysOverdue: Math.max(0, daysBetween(scheduledDate, today)),
      planId: rata.plan.id,
    });
  }

  return entries;
}

/**
 * Raggruppa le rate selezionate per (piano, data): payInstallments accetta rate di
 * un solo piano con una sola data → una transazione per gruppo.
 */
export function groupInstallments(entries: DueEntry[], dateOf: (e: DueEntry) => string) {
  const groups = new Map<string, { planId: string; date: string; ids: string[] }>();
  for (const e of entries) {
    if (e.kind !== 'installment' || !e.planId) continue;
    const date = dateOf(e);
    const k = `${e.planId}|${date}`;
    const g = groups.get(k);
    if (g) g.ids.push(e.id);
    else groups.set(k, { planId: e.planId, date, ids: [e.id] });
  }
  return [...groups.values()];
}
