import prisma from './prisma';
import { listOccurrenceDates } from './occurrences';

// ── Periodo di paga (stipendio → stipendio) ──────────────────────────────────
//
//   Le analisi "quanto mi resta" hanno senso sul periodo tra due accrediti dello
//   stipendio, non sul mese solare (lo stipendio può cadere il 23). L'utente
//   configura:
//     • salaryCategoryId → la categoria degli accrediti stipendio;
//     • payDay           → giorno di riferimento, usato solo come ripiego.
//
//   Prossimo accredito, in ordine di priorità:
//     1. la prima pianificata INCOME non pagata della categoria (data confermata);
//     2. la prossima occorrenza di una ricorrente INCOME della categoria;
//     3. il payDay del mese (clampato alla lunghezza del mese);
//     4. nessuna configurazione → il 1° del mese prossimo (mese solare).
//   Periodi passati: le date REALI degli accrediti registrati nella categoria
//   (accrediti ravvicinati accorpati), completati a ritroso col payDay/mese solare
//   quando lo storico non basta.

const DAY_MS = 86_400_000;
// Accrediti entro questa distanza sono lo stesso stipendio (es. acconto + saldo).
const SAME_PAYDAY_DAYS = 7;
// Un periodo "plausibile" tra due accrediti: fuori da qui è un buco nello storico
// (es. mesi senza stipendio) e non va usato come periodo di confronto.
const MIN_PERIOD_DAYS = 20;
const MAX_PERIOD_DAYS = 45;

export type PayPeriodSource = 'planned' | 'recurring' | 'payday' | 'calendar';

export interface PeriodRange {
  start: Date; // 00:00 del giorno di inizio (incluso)
  end: Date;   // 00:00 del giorno di fine (escluso) = accredito successivo
}

export interface PayPeriodInfo {
  configured: boolean;
  start: Date;            // inizio del periodo corrente (00:00)
  nextPayday: Date;       // prossimo accredito atteso (00:00)
  source: PayPeriodSource;
  completedPeriods: PeriodRange[]; // periodi chiusi, dal più vecchio al più recente
}

export interface PayPeriodInput {
  now: Date;
  salaryConfigured: boolean;   // categoria stipendio impostata
  payDay: number | null;
  salaryDates: Date[];         // accrediti reali passati nella categoria
  plannedSalaryDates: Date[];  // pianificate INCOME non pagate della categoria
  recurringSalaryDates: Date[]; // prossime occorrenze di ricorrenti della categoria
  maxPeriods?: number;
}

export const startOfDay = (d: Date): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const addDays = (d: Date, n: number): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
export const daysBetween = (a: Date, b: Date): number => Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / DAY_MS);

// Data col giorno `day` nel mese (year, month), clampata alla lunghezza del mese.
const clampedDate = (year: number, month: number, day: number): Date => {
  const last = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(day, last));
};

// Primo payDay strettamente successivo a `after`.
const nextPayDayAfter = (after: Date, day: number): Date => {
  const same = clampedDate(after.getFullYear(), after.getMonth(), day);
  return same > after ? same : clampedDate(after.getFullYear(), after.getMonth() + 1, day);
};

// Ultimo payDay minore o uguale a `onOrBefore`.
const prevPayDayOnOrBefore = (onOrBefore: Date, day: number): Date => {
  const same = clampedDate(onOrBefore.getFullYear(), onOrBefore.getMonth(), day);
  return same <= onOrBefore ? same : clampedDate(onOrBefore.getFullYear(), onOrBefore.getMonth() - 1, day);
};

// Accorpa accrediti ravvicinati (tiene il primo del gruppo), ordinati ascendenti.
export const clusterPaydays = (dates: Date[]): Date[] => {
  const sorted = dates.map(startOfDay).sort((a, b) => a.getTime() - b.getTime());
  const out: Date[] = [];
  for (const d of sorted) {
    const last = out[out.length - 1];
    if (!last || daysBetween(last, d) > SAME_PAYDAY_DAYS) out.push(d);
  }
  return out;
};

// Funzione PURA (testabile): risolve periodo corrente e periodi chiusi.
export function resolvePayPeriod(input: PayPeriodInput): PayPeriodInfo {
  const today = startOfDay(input.now);
  const maxPeriods = input.maxPeriods ?? 3;
  const payDay = input.payDay && input.payDay >= 1 && input.payDay <= 31 ? input.payDay : null;
  const configured = input.salaryConfigured || payDay !== null;

  const paid = input.salaryConfigured ? clusterPaydays(input.salaryDates).filter((d) => d <= today) : [];
  const lastPaid = paid.length > 0 ? paid[paid.length - 1] : null;
  // Un candidato "prossimo accredito" troppo vicino all'ultimo accredito reale è
  // lo stesso stipendio (es. pianificata non segnata come pagata): va scartato.
  const isNewPayday = (d: Date) => !lastPaid || daysBetween(lastPaid, d) > SAME_PAYDAY_DAYS;

  let nextPayday: Date | null = null;
  let source: PayPeriodSource = 'calendar';

  if (input.salaryConfigured) {
    const planned = input.plannedSalaryDates
      .map(startOfDay)
      .filter((d) => d >= today && isNewPayday(d))
      .sort((a, b) => a.getTime() - b.getTime())[0];
    if (planned) {
      nextPayday = planned;
      source = 'planned';
    } else {
      const rec = input.recurringSalaryDates
        .map(startOfDay)
        .filter((d) => d >= today && isNewPayday(d))
        .sort((a, b) => a.getTime() - b.getTime())[0];
      if (rec) {
        nextPayday = rec;
        source = 'recurring';
      }
    }
  }

  if (!nextPayday && payDay !== null) {
    let candidate = nextPayDayAfter(today, payDay);
    while (!isNewPayday(candidate)) candidate = nextPayDayAfter(candidate, payDay);
    nextPayday = candidate;
    source = 'payday';
  }

  if (!nextPayday) {
    nextPayday = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    source = 'calendar';
  }

  // Inizio del periodo corrente: ultimo accredito reale se plausibile; altrimenti
  // il payDay precedente (se è il payDay a dare il prossimo accredito) o un mese
  // prima del prossimo accredito noto (pianificata/ricorrente: il payDay potrebbe
  // non coincidere); col mese solare, il 1° del mese.
  let start: Date;
  if (lastPaid && daysBetween(lastPaid, nextPayday) <= MAX_PERIOD_DAYS) {
    start = lastPaid;
  } else if (source === 'calendar') {
    start = new Date(today.getFullYear(), today.getMonth(), 1);
  } else if (source === 'payday') {
    start = prevPayDayOnOrBefore(today, payDay!);
  } else {
    start = clampedDate(nextPayday.getFullYear(), nextPayday.getMonth() - 1, nextPayday.getDate());
    if (start > today) start = today;
  }

  // Periodi chiusi dagli accrediti reali: coppie consecutive che terminano entro
  // l'inizio del periodo corrente, di durata plausibile.
  const real: PeriodRange[] = [];
  const bounds = paid.filter((d) => d <= start);
  for (let i = 1; i < bounds.length; i++) {
    const len = daysBetween(bounds[i - 1], bounds[i]);
    if (len >= MIN_PERIOD_DAYS && len <= MAX_PERIOD_DAYS) {
      real.push({ start: bounds[i - 1], end: bounds[i] });
    }
  }
  // Tieni solo la catena contigua che arriva a `start` (un buco interrompe lo storico).
  const chain: PeriodRange[] = [];
  let cursor = start;
  for (let i = real.length - 1; i >= 0 && chain.length < maxPeriods; i--) {
    if (real[i].end.getTime() !== cursor.getTime()) break;
    chain.unshift(real[i]);
    cursor = real[i].start;
  }

  // Completa a ritroso col payDay (o mese solare) finché servono periodi. Il
  // payDay precedente va cercato almeno MIN_PERIOD_DAYS prima: se l'ultimo
  // accredito reale è slittato (es. 24 invece di 23) non deve nascere un periodo
  // di un giorno.
  while (chain.length < maxPeriods) {
    const end = cursor;
    const prev = payDay !== null
      ? prevPayDayOnOrBefore(addDays(end, -MIN_PERIOD_DAYS), payDay)
      : new Date(end.getFullYear(), end.getMonth() - 1, end.getDate());
    chain.unshift({ start: prev, end });
    cursor = prev;
  }

  return { configured, start, nextPayday, source, completedPeriods: chain };
}

// ── Caricamento dal DB ───────────────────────────────────────────────────────

export async function loadPayPeriod(userId: string, now: Date = new Date(), maxPeriods = 3): Promise<PayPeriodInfo> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { salaryCategoryId: true, payDay: true },
  });
  const salaryCategoryId = user?.salaryCategoryId ?? null;
  const today = startOfDay(now);

  let salaryDates: Date[] = [];
  let plannedSalaryDates: Date[] = [];
  let recurringSalaryDates: Date[] = [];

  if (salaryCategoryId) {
    // Storico: abbastanza per maxPeriods periodi mensili + margine.
    const since = new Date(today.getFullYear(), today.getMonth() - (maxPeriods + 3), 1);
    const horizon = addDays(today, 62);
    const [txns, planned, recurring] = await Promise.all([
      prisma.transaction.findMany({
        where: { userId, type: 'INCOME', categoryId: salaryCategoryId, transferId: null, date: { gte: since, lte: now } },
        select: { date: true },
      }),
      prisma.plannedTransaction.findMany({
        where: { userId, type: 'INCOME', categoryId: salaryCategoryId, isPaid: false, plannedDate: { gte: today, lte: horizon } },
        select: { plannedDate: true },
      }),
      prisma.recurringTransaction.findMany({
        where: { userId, type: 'INCOME', categoryId: salaryCategoryId, isActive: true },
      }),
    ]);
    salaryDates = txns.map((t) => t.date);
    plannedSalaryDates = planned.flatMap((p) => (p.plannedDate ? [p.plannedDate] : []));
    recurringSalaryDates = recurring.flatMap((r) =>
      listOccurrenceDates(
        {
          frequency: r.frequency as 'WEEKLY' | 'MONTHLY' | 'YEARLY',
          dayOfMonth: r.dayOfMonth,
          startDate: r.startDate,
          endDate: r.endDate,
          amount: r.amount,
        },
        today,
        horizon,
      ),
    );
  }

  return resolvePayPeriod({
    now,
    salaryConfigured: !!salaryCategoryId,
    payDay: user?.payDay ?? null,
    salaryDates,
    plannedSalaryDates,
    recurringSalaryDates,
    maxPeriods,
  });
}

// Forma JSON per il client (date come YYYY-MM-DD locali, niente fusi orari).
const iso = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function serializePayPeriod(p: PayPeriodInfo, now: Date = new Date()) {
  const today = startOfDay(now);
  return {
    configured: p.configured,
    source: p.source,
    start: iso(p.start),
    nextPayday: iso(p.nextPayday),
    daysElapsed: Math.max(1, daysBetween(p.start, today) + 1),
    daysTotal: Math.max(1, daysBetween(p.start, p.nextPayday)),
    daysToPayday: Math.max(0, daysBetween(today, p.nextPayday)),
  };
}

// ── Periodi di analisi (dal più vecchio; l'ultimo è quello in corso) ─────────

export interface AnalysisPeriod {
  start: Date;      // 00:00 incluso
  end: Date;        // 00:00 escluso
  isCurrent: boolean;
}

// Mesi solari: gli ultimi `count` mesi, quello corrente incluso.
export function calendarPeriods(now: Date, count: number): AnalysisPeriod[] {
  const out: AnalysisPeriod[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    out.push({ start, end, isCurrent: i === 0 });
  }
  return out;
}

// Periodi di paga: i periodi chiusi risolti + quello in corso (fino al prossimo accredito).
export function payPeriodsForAnalysis(info: PayPeriodInfo): AnalysisPeriod[] {
  return [
    ...info.completedPeriods.map((p) => ({ start: p.start, end: p.end, isCurrent: false })),
    { start: info.start, end: info.nextPayday, isCurrent: true },
  ];
}

// ── Calendario dei periodi di paga (per le finestre dei budget PAY_PERIOD) ───
//
//   Una sequenza ordinata di "confini" (giorni di accredito, 00:00): la finestra
//   i-esima è [confine_i, confine_i+1). Confini = accrediti reali passati +
//   prossimo accredito atteso; i buchi (> MAX_PERIOD_DAYS, es. mesi senza
//   stipendio) e gli estremi fino a [from, to] si completano col payDay (o, senza
//   payDay, con lo stesso giorno del mese precedente/successivo).

// Passo avanti di un periodo da un confine.
const stepForward = (b: Date, payDay: number | null): Date =>
  payDay !== null
    ? nextPayDayAfter(addDays(b, MIN_PERIOD_DAYS - 1), payDay)
    : clampedDate(b.getFullYear(), b.getMonth() + 1, b.getDate());

// Passo indietro di un periodo da un confine.
const stepBack = (b: Date, payDay: number | null): Date =>
  payDay !== null
    ? prevPayDayOnOrBefore(addDays(b, -MIN_PERIOD_DAYS), payDay)
    : clampedDate(b.getFullYear(), b.getMonth() - 1, b.getDate());

// Funzione PURA (testabile).
export function buildPayBoundaries(input: {
  paydays: Date[];     // accrediti reali passati (già accorpati)
  nextPayday: Date;
  payDay: number | null;
  from: Date;
  to: Date;
}): Date[] {
  const payDay = input.payDay && input.payDay >= 1 && input.payDay <= 31 ? input.payDay : null;
  const base = [...input.paydays.map(startOfDay), startOfDay(input.nextPayday)]
    .sort((a, b) => a.getTime() - b.getTime())
    .filter((d, i, arr) => i === 0 || daysBetween(arr[i - 1], d) > SAME_PAYDAY_DAYS);

  // Riempie i buchi troppo lunghi tra confini consecutivi.
  const filled: Date[] = [];
  for (let i = 0; i < base.length; i++) {
    filled.push(base[i]);
    const next = base[i + 1];
    if (!next) break;
    let cur = base[i];
    while (daysBetween(cur, next) > MAX_PERIOD_DAYS) {
      const step = stepForward(cur, payDay);
      if (daysBetween(step, next) < MIN_PERIOD_DAYS) break;
      filled.push(step);
      cur = step;
    }
  }

  const from = startOfDay(input.from);
  const to = startOfDay(input.to);
  while (filled[0] > from) filled.unshift(stepBack(filled[0], payDay));
  while (filled[filled.length - 1] <= to) filled.push(stepForward(filled[filled.length - 1], payDay));
  return filled;
}

// Confini dal DB. null = periodo di paga non configurato (chi lo usa ricade sul mese).
export async function loadPayBoundaries(userId: string, from: Date, to: Date, now: Date = new Date()): Promise<Date[] | null> {
  const info = await loadPayPeriod(userId, now);
  if (!info.configured) return null;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { salaryCategoryId: true, payDay: true } });
  const salaryDates = user?.salaryCategoryId
    ? (await prisma.transaction.findMany({
        where: {
          userId, type: 'INCOME', categoryId: user.salaryCategoryId, transferId: null,
          date: { gte: addDays(from, -MAX_PERIOD_DAYS), lte: now },
        },
        select: { date: true },
      })).map((t) => t.date)
    : [];
  const paydays = clusterPaydays(salaryDates).filter((d) => d <= startOfDay(now) && d < info.nextPayday);
  return buildPayBoundaries({ paydays, nextPayday: info.nextPayday, payDay: user?.payDay ?? null, from, to });
}
