import { format } from 'date-fns';
import type {
  Account,
  InstallmentDueRata,
  PlannedTransaction,
  RecurringDueItem,
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
  /** 0 = oggi, >0 = giorni di ritardo, <0 = scadenza futura (registrazione anticipata). */
  daysOverdue: number;
  /** Solo rate: piano di appartenenza (il pagamento è per piano). */
  planId?: string;
  /** Sospeso: nessuna data prevista, la data proposta è oggi. */
  undated?: boolean;
  /** Nessun conto fisso (rata di un piano a pagamento manuale, o pianificata
   *  senza conto): il conto si sceglie ora, al momento della registrazione. */
  needsAccount?: boolean;
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

/** Oggi, locale YYYY-MM-DD. */
export const todayLocal = (): string => format(new Date(), 'yyyy-MM-dd');

const daysBetween = (fromDay: string, toDay: string): number => {
  const [fy, fm, fd] = fromDay.split('-').map(Number);
  const [ty, tm, td] = toDay.split('-').map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000);
};

// ── Conversione di una singola scadenza in voce del popup ──
// Usate sia dal promemoria (scadenze dovute) sia dai click sulle card delle liste
// (anche scadenze future o Sospesi): un solo modo di registrare una scadenza.

export function recurringToEntry(r: RecurringDueItem, today: string): DueEntry {
  const scheduledDate = toLocalDay(r.nextDueDate);
  return {
    key: `r:${r.id}`,
    kind: 'recurring',
    id: r.id,
    title: r.description,
    subtitle: r.category?.name ?? 'Senza categoria',
    amount: Number(r.amount),
    type: r.type,
    scheduledDate,
    daysOverdue: daysBetween(scheduledDate, today),
  };
}

/** Pianificata (o addebito ciclo CC se ha ccAccountId, o Sospeso se senza data). */
export function plannedToEntry(p: PlannedTransaction, accounts: Account[], today: string): DueEntry {
  const scheduledDate = p.plannedDate ? toLocalDay(p.plannedDate) : today;
  const isCc = !!p.ccAccountId;
  const bank = p.account?.name ?? accounts.find((a) => a.id === p.accountId)?.name;
  return {
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
    daysOverdue: daysBetween(scheduledDate, today),
    ...(p.plannedDate ? {} : { undated: true }),
    // Una pianificata senza conto non si può registrare senza sceglierne uno.
    ...(!isCc && !p.accountId && accounts.length > 0 ? { needsAccount: true } : {}),
  };
}

export function rataToEntry(
  rata: PlannedTransaction,
  plan: { id: string; title: string; accountId?: string | null },
  today: string,
): DueEntry {
  const scheduledDate = rata.plannedDate ? toLocalDay(rata.plannedDate) : today;
  return {
    key: `i:${rata.id}`,
    kind: 'installment',
    id: rata.id,
    // description = "Titolo piano — rata X/Y": dice quale rata si sta registrando.
    title: rata.description || plan.title,
    subtitle: rata.counterparty ? `Piano a rate · ${rata.counterparty}` : 'Piano a rate',
    amount: Number(rata.amount),
    type: rata.type,
    scheduledDate,
    daysOverdue: daysBetween(scheduledDate, today),
    planId: plan.id,
    ...(plan.accountId ? {} : { needsAccount: true }),
  };
}

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
  return [
    ...[...(recurring?.dueToday ?? []), ...(recurring?.overdue ?? [])].map((r) => recurringToEntry(r, today)),
    ...planned.filter((p) => p.plannedDate).map((p) => plannedToEntry(p, accounts, today)),
    ...installments.filter((r) => r.plannedDate).map((r) => rataToEntry(r, r.plan, today)),
  ];
}

/**
 * Raggruppa le rate selezionate per (piano, data, conto): payInstallments accetta
 * rate di un solo piano con una sola data e un solo conto → una transazione per gruppo.
 * accountOf: conto scelto nel popup (solo piani a pagamento manuale), altrimenti
 * undefined = conto del piano.
 */
export function groupInstallments(
  entries: DueEntry[],
  dateOf: (e: DueEntry) => string,
  accountOf: (e: DueEntry) => string | undefined = () => undefined,
) {
  const groups = new Map<string, { planId: string; date: string; accountId?: string; ids: string[] }>();
  for (const e of entries) {
    if (e.kind !== 'installment' || !e.planId) continue;
    const date = dateOf(e);
    const accountId = accountOf(e);
    const k = `${e.planId}|${date}|${accountId ?? ''}`;
    const g = groups.get(k);
    if (g) g.ids.push(e.id);
    else groups.set(k, { planId: e.planId, date, ...(accountId ? { accountId } : {}), ids: [e.id] });
  }
  return [...groups.values()];
}
