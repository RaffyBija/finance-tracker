import prisma from './prisma';
import { projectCcCharges, type AccountBalance, type CcEvent } from './balance';
import { listOccurrenceDates } from './occurrences';

// ── Helper della proiezione del saldo ─────────────────────────────────────────
//   Condivisi da getProjectionSeries (pagina /projection) e getForecast (stima
//   per periodo di paga della dashboard), così i due non divergono.

export const dayKey = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// Costruisce il tratto PROIETTATO del grafico: un punto per OGNI giorno civile
// tra rangeStart e rangeEnd (inclusi), mai un punto per evento. Se più eventi
// cadono lo stesso giorno vengono aggregati in un solo delta netto, e i giorni
// senza eventi riportano in avanti l'ultimo saldo noto (forward-fill). Questo
// mantiene l'asse X (categoriale in Recharts, non a scala temporale) sempre a
// densità 1 punto/giorno: senza questo, un giorno con più eventi produceva più
// punti duplicati con la stessa data ma saldo intermedio/finale, disallineando
// la posizione visiva dal tempo reale e rendendo la lettura del grafico
// dipendente dall'orizzonte scelto.
// Il punto di rangeStart ("oggi") resta fissato a currentBalance esatto — gli
// eventi datati oggi si riflettono solo dal punto di domani in poi, per
// preservare la giunzione visiva con actualPoints (che converge già a
// currentBalance) e la label "Oggi" mostrata in ProjectionPage/ProjectedView.
export function buildProjectedPoints(
  currentBalance: number,
  events: { date: Date; amount: number; type: 'INCOME' | 'EXPENSE' }[],
  rangeStart: Date,
  rangeEnd: Date,
): { date: string; balance: number; projected: boolean }[] {
  const deltaByDay: Record<string, number> = {};
  for (const ev of events) {
    const k = dayKey(ev.date);
    const signed = ev.type === 'INCOME' ? ev.amount : -ev.amount;
    deltaByDay[k] = (deltaByDay[k] ?? 0) + signed;
  }

  const points: { date: string; balance: number; projected: boolean }[] = [];
  let running = currentBalance;

  points.push({ date: dayKey(rangeStart), balance: running, projected: true });
  running += deltaByDay[dayKey(rangeStart)] ?? 0;

  const day = new Date(rangeStart);
  day.setDate(day.getDate() + 1);
  while (day <= rangeEnd) {
    const k = dayKey(day);
    running += deltaByDay[k] ?? 0;
    points.push({ date: k, balance: running, projected: true });
    day.setDate(day.getDate() + 1);
  }
  return points;
}


export type ProjectionEventLike = { date: Date; amount: number; type: 'INCOME' | 'EXPENSE' };

// Converte il ritmo quotidiano (spesa variabile stimata, €/giorno) in eventi di
// liquidità, rispettando la semantica BANK vs CC:
//   • la quota storicamente pagata dai conti BANK esce ogni giorno;
//   • la quota pagata con carta NON esce alla sua data: si somma al debito del
//     ciclo e diventa parte dell'addebito al billingDay (via projectCcCharges).
//     Si calcola come differenza tra gli addebiti con e senza il ritmo, così il
//     debito già maturato e le spese future note non vengono contati due volte.
//   Eventi da rangeStart+1 (il giorno "oggi" resta ancorato al saldo attuale,
//   come in buildProjectedPoints) fino a rangeEnd inclusi.
//
//   scopeId: null = tutti i conti; altrimenti un conto BANK + le sue carte collegate.
export function buildRhythmEvents(params: {
  rate: number;
  shareByAccount: Record<string, number>;
  accounts: AccountBalance[];
  scopeId: string | null;
  rangeStart: Date;
  rangeEnd: Date;
  ccEvents: CcEvent[];
  ccAccountsForCharge: AccountBalance[];
  now: Date;
}): ProjectionEventLike[] {
  const { rate, shareByAccount, accounts, scopeId, rangeStart, rangeEnd, ccEvents, ccAccountsForCharge, now } = params;
  if (rate <= 0) return [];

  // Carte archiviate: nessun ciclo futuro, la loro quota storica esce dal conto
  // come spesa diretta (chi chiude una carta paga in altro modo).
  const isActiveCard = (a: AccountBalance) => a.type === 'CREDIT_CARD' && !a.archived;
  const chargeCardIds = new Set(ccAccountsForCharge.filter(isActiveCard).map((a) => a.id));
  const allCardIds = new Set(accounts.filter(isActiveCard).map((a) => a.id));
  const cardShares = Object.entries(shareByAccount).filter(([id, share]) => chargeCardIds.has(id) && share > 0);

  // Quota che esce direttamente dalla liquidità dello scope.
  const bankShare = scopeId
    ? shareByAccount[scopeId] ?? 0
    : Object.entries(shareByAccount)
        .filter(([id]) => !allCardIds.has(id))
        .reduce((s, [, share]) => s + share, 0);

  const days: Date[] = [];
  const cursor = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), rangeStart.getDate() + 1);
  while (cursor <= rangeEnd) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  const events: ProjectionEventLike[] = [];
  const bankDaily = rate * bankShare;
  if (bankDaily > 0) {
    for (const d of days) events.push({ date: d, amount: bankDaily, type: 'EXPENSE' });
  }

  if (cardShares.length > 0 && days.length > 0) {
    const rhythmCc: CcEvent[] = [];
    for (const d of days) {
      for (const [cardId, share] of cardShares) rhythmCc.push({ cardId, date: d, signed: rate * share });
    }
    const byDay = new Map<string, { date: Date; amount: number }>();
    const add = (date: Date, amount: number) => {
      const k = dayKey(date);
      const e = byDay.get(k);
      if (e) e.amount += amount;
      else byDay.set(k, { date, amount });
    };
    for (const c of projectCcCharges(ccAccountsForCharge, [...ccEvents, ...rhythmCc], rangeStart, rangeEnd, now)) add(c.date, c.amount);
    for (const c of projectCcCharges(ccAccountsForCharge, ccEvents, rangeStart, rangeEnd, now)) add(c.date, -c.amount);
    for (const { date, amount } of byDay.values()) {
      if (amount > 0.005) events.push({ date, amount, type: 'EXPENSE' });
    }
  }

  return events;
}

// Raccoglie gli eventi FUTURI della proiezione nel range: ricorrenti, pianificate
// non pagate, sospesi (opt-in) e addebiti dei cicli carta. Fonte unica usata da
// getProjectionSeries e dalla previsione per periodo di paga (getForecast).
export type ProjectionSource = 'recurring' | 'planned' | 'cc' | 'sospeso';
export type FutureEvent = { date: Date; label: string; amount: number; type: 'INCOME' | 'EXPENSE'; source: ProjectionSource };

export async function collectProjectionEvents(params: {
  userId: string;
  accounts: AccountBalance[];
  scopeId: string | null;
  rangeStart: Date;
  rangeEnd: Date;
  withSuspended: boolean;
  now: Date;
}) {
  const { userId, accounts, scopeId, rangeStart, rangeEnd, withSuspended, now } = params;
  // Vista per-conto: includiamo anche le CC collegate a QUESTO conto (linkedAccountId).
  // Isolare una CC dal proprio ciclo di fatturazione non ha senso (il suo saldo da
  // sola non è significativo) — il ciclo va sempre visto insieme al conto su cui si
  // scaricherà l'addebito, esattamente come già avviene in modalità "tutti i conti".
  const scopedAccountIds = scopeId
    ? [scopeId, ...accounts.filter((a) => a.type === 'CREDIT_CARD' && a.linkedAccountId === scopeId).map((a) => a.id)]
    : null;

  // ── FUTURO: raccoglie gli eventi (ricorrenti + pianificate + CC + sospesi) ──
  const events: FutureEvent[] = [];
  let projectedIncome  = 0;
  let projectedExpense = 0;
  let recurringCount   = 0;
  let plannedCount     = 0;
  let suspendedCount   = 0;

  const recurringTransactions = await prisma.recurringTransaction.findMany({
    where: {
      userId,
      ...(scopedAccountIds ? { accountId: { in: scopedAccountIds } } : {}),
      isActive: true,
      startDate: { lte: rangeEnd },
      OR: [{ endDate: null }, { endDate: { gte: rangeStart } }],
    },
  });

  // Conti CC: le spese addebitate su carta non escono dalla liquidità alla loro data
  // → raccolte come ccEvents e proiettate come addebito del ciclo (projectCcCharges).
  // Vale sia in vista globale sia in vista per-conto (per le CC collegate a scopeId,
  // filtrate a monte da scopedAccountIds).
  const ccIds = new Set(accounts.filter((a) => a.type === 'CREDIT_CARD').map((a) => a.id));
  const ccEvents: CcEvent[] = [];

  for (const rec of recurringTransactions) {
    const occurrences = listOccurrenceDates(
      {
        frequency:  rec.frequency as 'WEEKLY' | 'MONTHLY' | 'YEARLY',
        dayOfMonth: rec.dayOfMonth,
        startDate:  rec.startDate,
        endDate:    rec.endDate,
        amount:     rec.amount,
      },
      rangeStart,
      rangeEnd,
    );
    const amount = Number(rec.amount);
    const isCc = rec.accountId && ccIds.has(rec.accountId);
    for (const date of occurrences) {
      recurringCount += 1;
      if (isCc) {
        ccEvents.push({ cardId: rec.accountId!, date, signed: rec.type === 'INCOME' ? -amount : amount });
        continue;
      }
      if (rec.type === 'INCOME') projectedIncome  += amount;
      else                       projectedExpense += amount;
      events.push({ date, label: rec.description, amount, type: rec.type as 'INCOME' | 'EXPENSE', source: 'recurring' });
    }
  }

  const plannedTransactions = await prisma.plannedTransaction.findMany({
    where: {
      userId,
      ...(scopedAccountIds ? { accountId: { in: scopedAccountIds } } : {}),
      isPaid: false,
      plannedDate: { gte: rangeStart, lte: rangeEnd },
    },
  });

  plannedCount = plannedTransactions.length;
  for (const p of plannedTransactions) {
    const amount = Number(p.amount);
    // Filtrata per range di plannedDate a monte: mai null qui.
    if (p.accountId && ccIds.has(p.accountId)) {
      ccEvents.push({ cardId: p.accountId, date: p.plannedDate!, signed: p.type === 'INCOME' ? -amount : amount });
      continue;
    }
    if (p.type === 'INCOME') projectedIncome  += amount;
    else                     projectedExpense += amount;
    events.push({ date: p.plannedDate!, label: p.description, amount, type: p.type as 'INCOME' | 'EXPENSE', source: 'planned' });
  }

  // Sospesi (plannedDate null, opt-in via includeSuspended): nessuna data reale, quindi
  // contati come se accadessero oggi (anchor della proiezione) — è una stima di
  // esposizione totale, non un evento datato come gli altri. Mai inclusi di default.
  if (withSuspended) {
    const suspended = await prisma.plannedTransaction.findMany({
      where: {
        userId,
        planId: null,
        isPaid: false,
        plannedDate: null,
        ...(scopedAccountIds ? { accountId: { in: scopedAccountIds } } : {}),
      },
    });
    suspendedCount = suspended.length;
    for (const s of suspended) {
      const amount = Number(s.amount);
      // Un Sospeso su CC confluisce nel ciclo come le altre voci, non abbassa/alza
      // direttamente la liquidità proiettata.
      if (s.accountId && ccIds.has(s.accountId)) {
        ccEvents.push({ cardId: s.accountId, date: rangeStart, signed: s.type === 'INCOME' ? -amount : amount });
        continue;
      }
      if (s.type === 'INCOME') projectedIncome  += amount;
      else                     projectedExpense += amount;
      events.push({ date: rangeStart, label: s.description, amount, type: s.type as 'INCOME' | 'EXPENSE', source: 'sospeso' });
    }
  }

  // Addebiti CC futuri → uscita di liquidità al billingDay del ciclo (debito del ciclo
  // aperto + spese future su CC, aggregati per ciclo, una volta sola). In vista per-conto
  // limitato alle sole CC collegate a scopeId (projectCcCharges filtra internamente per
  // CREDIT_CARD ed è no-op se l'array non ne contiene nessuna).
  const ccAccountsForCharge = scopeId
    ? accounts.filter((a) => a.type === 'CREDIT_CARD' && (a.id === scopeId || a.linkedAccountId === scopeId))
    : accounts;
  for (const charge of projectCcCharges(ccAccountsForCharge, ccEvents, rangeStart, rangeEnd, now)) {
    projectedExpense += charge.amount;
    events.push({ date: charge.date, label: 'Addebito carta di credito', amount: charge.amount, type: 'EXPENSE', source: 'cc' });
  }

  return {
    events, ccEvents, ccAccountsForCharge, scopedAccountIds,
    projectedIncome, projectedExpense, recurringCount, plannedCount, suspendedCount,
  };
}
