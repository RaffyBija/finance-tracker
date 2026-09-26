import { BudgetPeriod } from '@prisma/client';

// ── Finestre di periodo dei budget ──────────────────────────────────────────────
//
//   Principio guida (mutuato dai cicli di fatturazione, vedi billingCycle.ts):
//   l'appartenenza di una transazione a un periodo di budget è una FUNZIONE
//   DETERMINISTICA della sua data e del `period` del budget. Lo "speso" di ogni
//   periodo è ri-derivabile dalle transazioni nella sua finestra [start, end],
//   quindi il budget si "azzera" da solo a ogni periodo SENZA toccare startDate,
//   e lo storico di qualsiasi periodo passato resta interrogabile.
//
//   Le finestre sono ALLINEATE AL CALENDARIO:
//     MONTHLY    → [1° del mese, ultimo giorno del mese]
//     YEARLY     → [1 gen, 31 dic]
//     WEEKLY     → [lunedì, domenica] (settimana ISO, lun-based)
//     PAY_PERIOD → [giorno di accredito, giorno prima del successivo], dai confini
//                  del periodo di paga (loadPayBoundaries). Senza confini (periodo di
//                  paga non configurato) si comporta come MONTHLY.
//   `startDate` del budget è solo l'ancora "attivo da"; `endDate` "attivo fino a".

export interface BudgetWindow {
  periodStart: Date; // 00:00:00.000 del primo giorno della finestra
  periodEnd: Date; // 23:59:59.999 dell'ultimo giorno della finestra
}

function startOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

function endOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(23, 59, 59, 999);
  return r;
}

// Finestra calendario che contiene `date`, per il dato period. `payBoundaries`
// (ordinati, 00:00) servono solo a PAY_PERIOD.
export function budgetWindowFor(date: Date, period: BudgetPeriod, payBoundaries?: Date[] | null): BudgetWindow {
  const d = new Date(date);

  if (period === 'PAY_PERIOD' && payBoundaries && payBoundaries.length >= 2) {
    // I confini devono coprire la data (loadPayBoundaries li estende a [from, to]
    // con margine): fuori copertura si usa la finestra estrema più vicina.
    const t = d.getTime();
    let i = t < payBoundaries[0].getTime() ? 0 : payBoundaries.length - 2;
    for (let k = 0; k < payBoundaries.length - 1; k++) {
      if (t >= payBoundaries[k].getTime() && t < payBoundaries[k + 1].getTime()) { i = k; break; }
    }
    const end = new Date(payBoundaries[i + 1]);
    end.setDate(end.getDate() - 1);
    return { periodStart: startOfDay(payBoundaries[i]), periodEnd: endOfDay(end) };
  }

  if (period === 'YEARLY') {
    const start = startOfDay(new Date(d.getFullYear(), 0, 1));
    const end = endOfDay(new Date(d.getFullYear(), 11, 31));
    return { periodStart: start, periodEnd: end };
  }

  if (period === 'WEEKLY') {
    // Settimana ISO: lunedì → domenica. getDay() = 0 (dom) .. 6 (sab).
    const day = d.getDay();
    const diffToMonday = (day + 6) % 7; // dom→6, lun→0, mar→1, ...
    const monday = startOfDay(d);
    monday.setDate(d.getDate() - diffToMonday);
    const sunday = endOfDay(new Date(monday));
    sunday.setDate(monday.getDate() + 6);
    return { periodStart: monday, periodEnd: endOfDay(sunday) };
  }

  // MONTHLY (default)
  const start = startOfDay(new Date(d.getFullYear(), d.getMonth(), 1));
  const end = endOfDay(new Date(d.getFullYear(), d.getMonth() + 1, 0)); // giorno 0 del mese dopo = ultimo del mese
  return { periodStart: start, periodEnd: end };
}

// Finestra del periodo corrente (quella che contiene `now`).
export function currentBudgetWindow(period: BudgetPeriod, now: Date = new Date(), payBoundaries?: Date[] | null): BudgetWindow {
  return budgetWindowFor(now, period, payBoundaries);
}

// Le `count` finestre più recenti, dalla più vecchia alla corrente (ordine cronologico).
export function recentBudgetWindows(
  period: BudgetPeriod,
  count: number,
  now: Date = new Date(),
  payBoundaries?: Date[] | null,
): BudgetWindow[] {
  const windows: BudgetWindow[] = [];
  // Partiamo dalla finestra corrente e arretriamo di un giorno oltre l'inizio
  // di ogni finestra per ottenere quella precedente.
  let cursor = new Date(now);
  for (let i = 0; i < count; i++) {
    const w = budgetWindowFor(cursor, period, payBoundaries);
    windows.push(w);
    cursor = new Date(w.periodStart);
    cursor.setDate(cursor.getDate() - 1); // giorno prima dell'inizio finestra → finestra precedente
  }
  return windows.reverse();
}

const MONTHS_IT = [
  'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre',
];

// Etichetta leggibile della finestra.
//   MONTHLY → "luglio 2026"
//   YEARLY  → "2026"
//   WEEKLY  → "1–7 lug 2026"
//   PAY_PERIOD → "24 set – 22 ott 2026" (con confini; altrimenti come MONTHLY)
export function budgetWindowLabel(window: BudgetWindow, period: BudgetPeriod): string {
  const s = window.periodStart;
  const e = window.periodEnd;

  // Una finestra PAY_PERIOD senza confini ricade sul mese solare: stessa etichetta.
  const isCalendarMonth = s.getDate() === 1 && e.getMonth() === s.getMonth()
    && e.getDate() === new Date(s.getFullYear(), s.getMonth() + 1, 0).getDate();
  if (period === 'PAY_PERIOD' && !isCalendarMonth) {
    const short = (d: Date) => `${d.getDate()} ${MONTHS_IT[d.getMonth()].slice(0, 3)}`;
    return `${short(s)} – ${short(e)} ${e.getFullYear()}`;
  }

  if (period === 'YEARLY') {
    return String(s.getFullYear());
  }

  if (period === 'WEEKLY') {
    const monthShort = MONTHS_IT[e.getMonth()].slice(0, 3);
    return `${s.getDate()}–${e.getDate()} ${monthShort} ${e.getFullYear()}`;
  }

  return `${MONTHS_IT[s.getMonth()]} ${s.getFullYear()}`;
}
