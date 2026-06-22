import { Response } from 'express';
import prisma from '../utils/prisma';
import { AuthRequest, CreateBudgetDTO } from '../types';
import { BudgetPeriod, BudgetRollover } from '@prisma/client';
import {
  BudgetWindow,
  currentBudgetWindow,
  recentBudgetWindows,
  budgetWindowLabel,
} from '../utils/budgetPeriod';
import { countOccurrences } from './dashboard.controller';
import { getAccountsWithBalances, getLiquidBalance, openCCObligations } from '../utils/balance';
import { expandToCategoryLines } from '../utils/categoryContributions';
import { analyticsCache } from '../utils/analyticsCache';

// Spesa di un budget DENTRO una finestra-periodo esplicita. La finestra effettiva è
// l'intersezione della finestra-periodo con l'intervallo di attività del budget
// [startDate, endDate]: così lo "speso" si azzera a ogni periodo e i periodi
// precedenti all'attivazione (o successivi alla scadenza) restano vuoti.
//
// Tiene conto delle transazioni divise (split):
// - budget globale (senza categoria) → somma di tutte le uscite (l'importo del padre
//   coincide con la somma delle righe, quindi il totale è corretto);
// - budget di categoria → uscite semplici con quella categoria + righe split con quella
//   categoria (i cui padri sono uscite nel periodo). I padri split hanno categoryId null,
//   quindi non vengono mai contati due volte.
const computeBudgetSpent = async (
  userId: string,
  budget: { categoryId: string | null; startDate: Date; endDate: Date | null },
  window: BudgetWindow,
): Promise<number> => {
  // Intersezione [finestra-periodo] ∩ [startDate, endDate]
  const gte = window.periodStart > budget.startDate ? window.periodStart : budget.startDate;
  const lte =
    budget.endDate && budget.endDate < window.periodEnd ? budget.endDate : window.periodEnd;

  // Finestra vuota (es. periodo interamente prima dell'attivazione o dopo la scadenza)
  if (gte > lte) return 0;

  const dateFilter = { gte, lte };
  const baseWhere = { userId, type: 'EXPENSE' as const, transferId: null, date: dateFilter };

  if (!budget.categoryId) {
    const agg = await prisma.transaction.aggregate({
      where: baseWhere,
      _sum: { amount: true },
    });
    return Number(agg._sum.amount || 0);
  }

  const [simple, splitItems] = await Promise.all([
    prisma.transaction.aggregate({
      where: { ...baseWhere, categoryId: budget.categoryId },
      _sum: { amount: true },
    }),
    prisma.transactionItem.aggregate({
      where: { categoryId: budget.categoryId, transaction: baseWhere },
      _sum: { amount: true },
    }),
  ]);

  return Number(simple._sum.amount || 0) + Number(splitItems._sum.amount || 0);
};

// Inizio/fine giornata locali. startDate/endDate sono salvati a mezzanotte dal date
// picker; le finestre-periodo usano l'ora locale. Normalizziamo a risoluzione-giorno
// per confronti robusti (un budget "attivo dal 1° giugno" copre l'intera finestra di
// giugno anche se l'istante salvato è leggermente sfasato).
const startOfLocalDay = (d: Date): Date => {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
};
const endOfLocalDay = (d: Date): Date => {
  const r = new Date(d);
  r.setHours(23, 59, 59, 999);
  return r;
};

// Percentuale di utilizzo rispetto al budget EFFETTIVO (base + riporto). Quando
// l'envelope è esaurito o negativo (debito riportato in modalità FULL), qualunque
// spesa — o il debito stesso — è uno sforamento: ritorniamo 100 così lo stato resta
// "over" (icona rossa, barra piena) coerente con `remaining` negativo, invece di
// collassare a 0 (che mostrerebbe la card come "entro il budget").
const budgetPercentage = (spent: number, envelope: number): number => {
  if (envelope > 0) return (spent / envelope) * 100;
  return spent > 0 || envelope < 0 ? 100 : 0;
};

// Tetto di costo: il carry accumula al più sugli ultimi N periodi precedenti.
const MAX_ROLLOVER_PERIODS = 12;

// Carry "entrante" nella finestra corrente: piega le finestre precedenti attive in
// ordine cronologico. effective(k) = amount + carry(k); remaining = effective − spent;
//   SURPLUS → carry = max(0, remaining)  (lo sforamento non si riporta)
//   FULL    → carry = remaining          (avanzo e debito si riportano)
//   NONE    → 0
// Approssimazione documentata: il carry parte da 0 sulla finestra più vecchia
// considerata (al più MAX_ROLLOVER_PERIODS indietro).
const computeCarryIn = async (
  userId: string,
  budget: {
    categoryId: string | null;
    startDate: Date;
    endDate: Date | null;
    amount: any;
    rollover: BudgetRollover;
    period: BudgetPeriod;
  },
  current: BudgetWindow,
): Promise<number> => {
  if (budget.rollover === 'NONE') return 0;
  const amount = Number(budget.amount);
  // Ancoriamo le finestre a `current` (non a "ora"): così il carry è corretto anche
  // quando getBudgetHistory chiede il fold per una finestra storica. `+1` perché la
  // finestra corrente fa parte del set e viene poi scartata dal filtro.
  // Consideriamo solo finestre PRECEDENTI in cui il budget era attivo per l'INTERO
  // periodo: una finestra di attivazione/scadenza parziale accrediterebbe un envelope
  // intero per un budget esistito pochi giorni (avanzo/debito fantasma).
  const activeStart = startOfLocalDay(budget.startDate).getTime();
  const activeEnd = budget.endDate ? endOfLocalDay(budget.endDate).getTime() : Infinity;
  const windows = recentBudgetWindows(
    budget.period,
    MAX_ROLLOVER_PERIODS + 1,
    current.periodEnd,
  ).filter(
    (w) =>
      w.periodEnd < current.periodStart && // solo periodi precedenti a quello corrente
      w.periodStart.getTime() >= activeStart && // budget attivo dall'inizio della finestra
      w.periodEnd.getTime() <= activeEnd, // … e fino alla fine della finestra
  );

  let carry = 0;
  for (const w of windows) {
    const spent = await computeBudgetSpent(userId, budget, w);
    const remaining = amount + carry - spent;
    carry = budget.rollover === 'FULL' ? remaining : Math.max(0, remaining);
  }
  return carry;
};

// Ottieni tutti i budget
export const getBudgets = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { active } = req.query;

    const where: any = { userId };
    
    // Filtra solo budget attivi
    if (active === 'true') {
      const now = new Date();
      where.startDate = { lte: now };
      where.OR = [
        { endDate: null },
        { endDate: { gte: now } },
      ];
    }

    const budgets = await prisma.budget.findMany({
      where,
      include: {
        category: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Calcola spesa del periodo CORRENTE per ogni budget (la finestra dipende da `period`).
    const budgetsWithSpent = await Promise.all(
      budgets.map(async (budget) => {
        const window = currentBudgetWindow(budget.period);
        const spent = await computeBudgetSpent(userId, budget, window);
        const carryIn = await computeCarryIn(userId, budget, window);
        const effectiveAmount = Number(budget.amount) + carryIn;

        return {
          ...budget,
          spent,
          carryIn,
          effectiveAmount,
          remaining: effectiveAmount - spent,
          percentage: budgetPercentage(spent, effectiveAmount),
          periodStart: window.periodStart,
          periodEnd: window.periodEnd,
          periodLabel: budgetWindowLabel(window, budget.period),
        };
      })
    );

    res.json(budgetsWithSpent);
  } catch (error) {
    console.error('Get budgets error:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
};

// Ottieni un singolo budget
export const getBudget = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const budget = await prisma.budget.findFirst({
      where: { id, userId },
      include: { category: true },
    });

    if (!budget) {
      return res.status(404).json({ error: 'Budget non trovato' });
    }

    // Calcola spesa del periodo corrente
    const window = currentBudgetWindow(budget.period);
    const spent = await computeBudgetSpent(userId, budget, window);
    const carryIn = await computeCarryIn(userId, budget, window);
    const effectiveAmount = Number(budget.amount) + carryIn;

    const budgetWithSpent = {
      ...budget,
      spent,
      carryIn,
      effectiveAmount,
      remaining: effectiveAmount - spent,
      percentage: budgetPercentage(spent, effectiveAmount),
      periodStart: window.periodStart,
      periodEnd: window.periodEnd,
      periodLabel: budgetWindowLabel(window, budget.period),
    };

    res.json(budgetWithSpent);
  } catch (error) {
    console.error('Get budget error:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
};

// Storico per-periodo di un budget: budget vs reale su N periodi recenti.
// Le finestre interamente precedenti a startDate o successive a endDate vengono
// scartate (il budget non era attivo). Restituisce anche statistiche aggregate.
export const getBudgetHistory = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const requested = Number(req.query.periods);
    const periods = Math.min(Math.max(Number.isFinite(requested) ? requested : 6, 1), 24);

    const budget = await prisma.budget.findFirst({
      where: { id, userId },
    });

    if (!budget) {
      return res.status(404).json({ error: 'Budget non trovato' });
    }

    const amount = Number(budget.amount);
    const windows = recentBudgetWindows(budget.period, periods);

    // Tieni solo le finestre che intersecano l'intervallo di attività del budget.
    const validWindows = windows.filter(
      (w) =>
        w.periodEnd >= budget.startDate &&
        (!budget.endDate || w.periodStart <= budget.endDate),
    );

    // Soglia (budgeted) per finestra = amount + carry. Il carry di OGNI finestra è
    // calcolato con lo STESSO computeCarryIn usato dalla card (cap MAX_ROLLOVER_PERIODS),
    // così la soglia del periodo corrente nello storico coincide con effectiveAmount della
    // card a prescindere da quanti periodi vengono mostrati. Per rollover NONE il carry è 0
    // → budgeted = amount (comportamento FASE 1). Costo: per ogni finestra mostrata un
    // computeCarryIn (≤12 computeBudgetSpent); accettabile per il dettaglio on-demand.
    const history = await Promise.all(
      validWindows.map(async (w) => {
        const spent = await computeBudgetSpent(userId, budget, w);
        const carry = await computeCarryIn(userId, budget, w);
        const budgeted = amount + carry;
        return {
          periodStart: w.periodStart,
          periodEnd: w.periodEnd,
          label: budgetWindowLabel(w, budget.period),
          budgeted,
          spent,
          remaining: budgeted - spent,
          percentage: budgetPercentage(spent, budgeted),
          exceeded: spent > budgeted,
        };
      }),
    );

    // Statistiche aggregate
    const totalPeriods = history.length;
    const exceededCount = history.filter((h) => h.exceeded).length;
    const avgSpent =
      totalPeriods > 0 ? history.reduce((s, h) => s + h.spent, 0) / totalPeriods : 0;
    const adherenceRate =
      totalPeriods > 0 ? ((totalPeriods - exceededCount) / totalPeriods) * 100 : 0;

    let bestPeriod: (typeof history)[number] | null = null;
    let worstPeriod: (typeof history)[number] | null = null;
    for (const h of history) {
      if (!bestPeriod || h.spent < bestPeriod.spent) bestPeriod = h;
      if (!worstPeriod || h.spent > worstPeriod.spent) worstPeriod = h;
    }

    res.json({
      period: budget.period,
      history,
      stats: {
        avgSpent,
        adherenceRate,
        exceededCount,
        totalPeriods,
        bestPeriod,
        worstPeriod,
      },
    });
  } catch (error) {
    console.error('Get budget history error:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
};

// Crea un budget
export const createBudget = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { name, amount, categoryId, period, startDate, endDate, rollover }: CreateBudgetDTO =
      req.body;

    if (!name || !amount || amount <= 0 || !period || !startDate) {
      return res.status(400).json({ error: 'Dati non validi' });
    }

    if (rollover !== undefined && !['NONE', 'SURPLUS', 'FULL'].includes(rollover)) {
      return res.status(400).json({ error: 'Modalità di riporto non valida' });
    }

    // Il form invia categoryId: '' per il budget complessivo. Normalizziamo a null:
    // passare '' come foreign key a Prisma viola il vincolo (nessuna categoria con id
    // '') → P2003 → 500. Con null il budget è correttamente "senza categoria".
    const normalizedCategoryId =
      typeof categoryId === 'string' && categoryId.trim() !== '' ? categoryId : null;

    if (normalizedCategoryId) {
      const category = await prisma.category.findFirst({
        where: { id: normalizedCategoryId, userId },
      });
      if (!category) {
        return res.status(404).json({ error: 'Categoria non trovata' });
      }
    }

    const budget = await prisma.budget.create({
      data: {
        name,
        amount,
        categoryId: normalizedCategoryId,
        period,
        rollover: rollover ?? 'NONE',
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        userId,
      },
      include: { category: true },
    });

    analyticsCache.delPattern(`budget-suggestions:${userId}`);
    res.status(201).json(budget);
  } catch (error) {
    console.error('Create budget error:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
};

// Aggiorna un budget
export const updateBudget = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { name, amount, categoryId, period, startDate, endDate, rollover } = req.body;

    const existingBudget = await prisma.budget.findFirst({
      where: { id, userId },
    });

    if (!existingBudget) {
      return res.status(404).json({ error: 'Budget non trovato' });
    }

    if (amount !== undefined && amount <= 0) {
      return res.status(400).json({ error: 'Importo non valido' });
    }

    if (rollover !== undefined && !['NONE', 'SURPLUS', 'FULL'].includes(rollover)) {
      return res.status(400).json({ error: 'Modalità di riporto non valida' });
    }

    // categoryId: undefined → non toccare; '' → budget complessivo (null); id → valida.
    // Senza la normalizzazione '' finirebbe come foreign key vuota → P2003 → 500.
    const normalizedCategoryId =
      categoryId === undefined
        ? undefined
        : typeof categoryId === 'string' && categoryId.trim() !== ''
          ? categoryId
          : null;

    if (normalizedCategoryId) {
      const category = await prisma.category.findFirst({
        where: { id: normalizedCategoryId, userId },
      });
      if (!category) {
        return res.status(404).json({ error: 'Categoria non trovata' });
      }
    }

    const budget = await prisma.budget.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(amount !== undefined && { amount }),
        ...(normalizedCategoryId !== undefined && { categoryId: normalizedCategoryId }),
        ...(period && { period }),
        ...(rollover !== undefined && { rollover }),
        ...(startDate && { startDate: new Date(startDate) }),
        ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
      },
      include: { category: true },
    });

    analyticsCache.delPattern(`budget-suggestions:${userId}`);
    res.json(budget);
  } catch (error) {
    console.error('Update budget error:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
};

// Elimina un budget
export const deleteBudget = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const budget = await prisma.budget.findFirst({
      where: { id, userId },
    });

    if (!budget) {
      return res.status(404).json({ error: 'Budget non trovato' });
    }

    await prisma.budget.delete({ where: { id } });
    analyticsCache.delPattern(`budget-suggestions:${userId}`);

    res.json({ message: 'Budget eliminato con successo' });
  } catch (error) {
    console.error('Delete budget error:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
};

// ── Budget automatico (Feature B): spendibile mensile + tetti proposti ──────────
//
// Riusa gli stessi building-block della previsione (getForecast):
//   • entrate/impegni del mese via countOccurrences (ricorrenti) + pianificate;
//   • cuscinetto = liquidità reale BANK al netto del debito dei cicli CC aperti
//     (getLiquidBalance − debito CC aperto: quella liquidità è già impegnata);
//   • medie storiche per categoria (split-aware via expandToCategoryLines).
//
//   disponibile = entratePreviste + cuscinetto − impegniFissi
//   spendibile  = disponibile − (max(0, disponibile) × savingRate)
//
// Includere il cuscinetto di liquidità è cruciale: un mese a reddito quasi zero non
// risulta "spendibile negativo" finché c'è liquidità a coprire gli impegni fissi.

const SUGG_HIST_MONTHS = 3;
const STANDARD_CUT = 0.15; // taglio "standard" sulla media storica per il tetto proposto

const round2 = (n: number): number => Math.round(n * 100) / 100;

type BudgetSuggestionItem = {
  categoryId: string;
  name: string;
  icon: string | null;
  color: string | null;
  avgMonthly: number;
  suggestedCap: number;
  currentBudgetId: string | null;
  currentAmount: number | null;
};

// Parte costosa e indipendente da savingRate → cacheabile. savingTarget e spendable
// si derivano da questa base con savingRate a runtime (così l'override dello slider
// non richiede invalidazione cache).
type BudgetSuggestionsBase = {
  expectedIncome: number;
  fixedCommitments: number;
  cushion: number;
  // Dettaglio per il breakdown UI:
  //   liquidity      = liquidità pura dei conti (selezionati) — saldo, niente proiezione;
  //   ccDueThisMonth = quota di fixedCommitments dovuta agli addebiti CC del mese target.
  // Per il mese prossimo (offset 1) cushion ≠ liquidity: la differenza è la proiezione
  // dei flussi residui del mese corrente (es. stipendio in arrivo).
  liquidity: number;
  ccDueThisMonth: number;
  perCategory: BudgetSuggestionItem[];
};

const computeBudgetSuggestionsBase = async (
  userId: string,
  monthOffset = 0,
  accountIds?: string[],
): Promise<BudgetSuggestionsBase> => {
  const now = new Date();
  // Mese target: corrente (offset 0) o futuro (offset 1 = prossimo). Le proposte
  // lavorano sul PIANO dell'intero mese (non prorata da oggi).
  const monthStart = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1, 0, 0, 0, 0);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + monthOffset + 1, 0, 23, 59, 59, 999);

  // Storico medie: SEMPRE ultimi SUGG_HIST_MONTHS mesi prima di adesso (non shiftato
  // dall'offset: le medie storiche non dipendono dal mese che stiamo proponendo).
  const histEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
  const histStart = new Date(now.getFullYear(), now.getMonth() - SUGG_HIST_MONTHS, 1, 0, 0, 0, 0);

  // Filtro conti (item c): se presente, cuscinetto + ricorrenti/pianificate sono
  // ristretti ai conti selezionati. I flussi SENZA conto (accountId null) sono
  // inclusi sempre (non attribuibili a un conto, quindi non escludibili).
  const filtering = Array.isArray(accountIds) && accountIds.length > 0;
  const selectedSet = new Set(accountIds ?? []);
  const acctWhere = filtering
    ? { OR: [{ accountId: { in: accountIds } }, { accountId: null }] }
    : {};

  const [accounts, recurringActive, plannedMonth, historicalTx, activeBudgets, systemCategories] = await Promise.all([
    getAccountsWithBalances(userId),
    prisma.recurringTransaction.findMany({ where: { userId, isActive: true, ...acctWhere } }),
    prisma.plannedTransaction.findMany({
      where: { userId, isPaid: false, plannedDate: { gte: monthStart, lte: monthEnd }, ...acctWhere },
    }),
    prisma.transaction.findMany({
      where: {
        userId,
        type: 'EXPENSE',
        date: { gte: histStart, lte: histEnd },
        fromRecurringId: null,
        transferId: null,
      },
      include: {
        category: { select: { id: true, name: true, icon: true, color: true } },
        items: { include: { category: { select: { id: true, name: true, icon: true, color: true } } } },
      },
    }),
    prisma.budget.findMany({
      where: {
        userId,
        categoryId: { not: null },
        startDate: { lte: now },
        OR: [{ endDate: null }, { endDate: { gte: now } }],
      },
      select: { id: true, categoryId: true, amount: true },
    }),
    // Categorie di sistema (es. "Pagamento Carta"): da escludere dalle medie per non
    // gonfiare una categoria con gli addebiti CC (chiude il doppio conteggio settlement).
    prisma.category.findMany({ where: { userId, isSystem: true }, select: { id: true } }),
  ]);

  const systemCatIds = new Set(systemCategories.map((c) => c.id));

  // Cuscinetto = liquidità BANK reale (NIENTE sottrazione del debito CC qui). Il debito
  // dei cicli CC aperti è un'uscita FUTURA che cade al prossimo billing day: va contato
  // come impegno nel mese in cui ricade l'addebito (vedi sotto), esattamente come fa la
  // proiezione (getProjectedBalance via openCCObligations). Scontarlo sempre dal
  // cuscinetto caricherebbe il mese corrente di un addebito che invece pesa su quello
  // successivo. I cicli CC chiusi sono già pianificate (contate negli impegni del mese).
  //
  // Con filtro conti sommiamo direttamente i BANK selezionati (NON via getLiquidBalance,
  // che su set vuoto ricadrebbe sul saldo all-time). Senza filtro riusiamo getLiquidBalance
  // (che mantiene il fallback per utenti senza conti).
  const liquid = filtering
    ? accounts
        .filter((a) => a.type !== 'CREDIT_CARD' && selectedSet.has(a.id))
        .reduce((sum, a) => sum + a.balance, 0)
    : await getLiquidBalance(userId, accounts);

  let cushion = liquid;

  // Cuscinetto PROIETTATO (item b, offset > 0): la liquidità di oggi non contiene ancora
  // i flussi residui del mese corrente (es. lo stipendio del 23, o un addebito CC dovuto
  // entro fine mese). Per proporre il mese prossimo proiettiamo il cuscinetto a inizio di
  // quel mese: entrate residue − impegni residui (ricorrenti + pianificate + addebiti CC
  // dovuti) nell'intervallo [oggi, fine del mese precedente al target].
  if (monthOffset > 0) {
    // Inizio giornata locale (come ogni altro range-start del codebase): un'occorrenza
    // di OGGI (es. stipendio del giorno stesso non ancora incassato) cade a mezzanotte
    // e dev'essere inclusa nel cuscinetto residuo, non scartata dal confronto con l'ora.
    const projStart = new Date(now);
    projStart.setHours(0, 0, 0, 0);
    const projEnd = new Date(monthStart.getFullYear(), monthStart.getMonth(), 0, 23, 59, 59, 999);

    const plannedResidual = await prisma.plannedTransaction.findMany({
      where: { userId, isPaid: false, plannedDate: { gte: projStart, lte: projEnd }, ...acctWhere },
    });

    let resDelta = 0;
    for (const rec of recurringActive) {
      const occ = countOccurrences(
        {
          frequency: rec.frequency as 'WEEKLY' | 'MONTHLY' | 'YEARLY',
          dayOfMonth: rec.dayOfMonth,
          startDate: rec.startDate,
          endDate: rec.endDate,
          amount: rec.amount,
        },
        projStart,
        projEnd,
      );
      if (occ === 0) continue;
      const total = occ * Number(rec.amount);
      resDelta += rec.type === 'INCOME' ? total : -total;
    }
    for (const p of plannedResidual) {
      resDelta += p.type === 'INCOME' ? Number(p.amount) : -Number(p.amount);
    }
    // Addebiti CC dovuti entro fine mese corrente (stessa logica della proiezione). Le CC
    // non sono tra i conti BANK filtrabili: il loro debito grava comunque sulla liquidità.
    resDelta -= openCCObligations(accounts, projStart, projEnd, now).total;
    cushion += resDelta;
  }

  // Entrate previste e impegni fissi del MESE INTERO (piano, non prorata da oggi)
  let expectedIncome = 0;
  let fixedCommitments = 0;

  for (const rec of recurringActive) {
    const occ = countOccurrences(
      {
        frequency: rec.frequency as 'WEEKLY' | 'MONTHLY' | 'YEARLY',
        dayOfMonth: rec.dayOfMonth,
        startDate: rec.startDate,
        endDate: rec.endDate,
        amount: rec.amount,
      },
      monthStart,
      monthEnd,
    );
    if (occ === 0) continue;
    const total = occ * Number(rec.amount);
    if (rec.type === 'INCOME') expectedIncome += total;
    else fixedCommitments += total;
  }

  for (const p of plannedMonth) {
    if (p.type === 'INCOME') expectedIncome += Number(p.amount);
    else fixedCommitments += Number(p.amount);
  }

  // Addebiti dei cicli CC aperti dovuti NEL MESE TARGET (prossimo billing day dentro
  // [monthStart, monthEnd]): impegno fisso del mese, come nella proiezione. Il cuscinetto
  // non li sconta più, quindi non c'è doppio conteggio. I cicli chiusi sono pianificate,
  // già incluse sopra in fixedCommitments.
  const ccDueThisMonth = openCCObligations(accounts, monthStart, monthEnd, now).total;
  fixedCommitments += ccDueThisMonth;

  // ── Medie storiche per categoria (split-aware), escluse le "senza categoria" ──
  type CatInfo = { name: string; icon: string | null; color: string | null };
  const catInfo = new Map<string, CatInfo>();
  const catTotals = new Map<string, number>();

  for (const t of historicalTx) {
    for (const line of expandToCategoryLines(t)) {
      if (!line.categoryId) continue;
      if (systemCatIds.has(line.categoryId)) continue; // addebiti CC: non discrezionali
      const key = line.categoryId;
      if (!catInfo.has(key)) {
        catInfo.set(key, {
          name: line.category?.name || 'Categoria',
          icon: line.category?.icon ?? null,
          color: line.category?.color ?? null,
        });
      }
      catTotals.set(key, (catTotals.get(key) || 0) + line.amount);
    }
  }

  const budgetByCat = new Map<string, { id: string; amount: number }>();
  for (const b of activeBudgets) {
    if (b.categoryId) budgetByCat.set(b.categoryId, { id: b.id, amount: Number(b.amount) });
  }

  const perCategory: BudgetSuggestionItem[] = [];
  catTotals.forEach((total, key) => {
    const avgMonthly = total / SUGG_HIST_MONTHS;
    if (avgMonthly < 0.01) return;
    const info = catInfo.get(key)!;
    const existing = budgetByCat.get(key) ?? null;
    perCategory.push({
      categoryId: key,
      name: info.name,
      icon: info.icon,
      color: info.color,
      avgMonthly: round2(avgMonthly),
      suggestedCap: round2(avgMonthly * (1 - STANDARD_CUT)),
      currentBudgetId: existing ? existing.id : null,
      currentAmount: existing ? existing.amount : null,
    });
  });
  perCategory.sort((a, b) => b.avgMonthly - a.avgMonthly);

  return {
    expectedIncome: round2(expectedIncome),
    fixedCommitments: round2(fixedCommitments),
    cushion: round2(cushion),
    liquidity: round2(liquid),
    ccDueThisMonth: round2(ccDueThisMonth),
    perCategory,
  };
};

// GET /budgets/suggestions?savingRate=<override?>&monthOffset=<0|1>&accountIds=<csv?>
export const getBudgetSuggestions = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

    // Override effimero dello slider (anteprima); altrimenti la preferenza salvata.
    let overrideRate: number | undefined;
    const raw = req.query.savingRate;
    if (typeof raw === 'string' && raw !== '') {
      const v = Number(raw);
      if (Number.isFinite(v) && v >= 0 && v <= 0.9) overrideRate = v;
    }

    // Mese target: 0 = corrente (default), 1 = prossimo (item b).
    const monthOffset = req.query.monthOffset === '1' ? 1 : 0;

    // Conti BANK selezionati (item c): CSV o array ripetuto. Validati come conti BANK
    // dell'utente; gli id ignoti vengono scartati. Se nessuno valido → nessun filtro.
    const rawAccts = req.query.accountIds;
    const requested = Array.isArray(rawAccts)
      ? (rawAccts as string[])
      : typeof rawAccts === 'string' && rawAccts !== ''
        ? rawAccts.split(',')
        : [];
    let accountIds: string[] | undefined;
    if (requested.length > 0) {
      const bankAccounts = await prisma.account.findMany({
        where: { userId, type: 'BANK', id: { in: requested } },
        select: { id: true },
      });
      const valid = bankAccounts.map((a) => a.id);
      if (valid.length > 0) accountIds = valid;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { savingRate: true },
    });
    const savingRate = overrideRate ?? Number(user?.savingRate ?? 0);

    // Cache key per-suffisso: mese + insieme di conti (ordinati per stabilità). La base
    // NON dipende da savingRate (derivato a runtime), quindi non entra nella chiave.
    const suffix = `o${monthOffset}${
      accountIds ? `_a${[...accountIds].sort().join('-')}` : ''
    }`;
    const cacheKey = analyticsCache.keys.budgetSuggestions(userId, suffix);
    let base = analyticsCache.get<BudgetSuggestionsBase>(cacheKey);
    if (!base) {
      base = await computeBudgetSuggestionsBase(userId, monthOffset, accountIds);
      analyticsCache.set(cacheKey, base);
    }

    // Il risparmio è una quota del disponibile del mese (entrate + cuscinetto −
    // impegni), non delle sole entrate: così lo slider funziona anche nei mesi a
    // reddito zero finché c'è liquidità. Clamp a 0 se il disponibile è negativo
    // (in rosso non si "mette da parte").
    const disposable = base.expectedIncome + base.cushion - base.fixedCommitments;
    const savingTarget = round2(Math.max(0, disposable) * savingRate);
    const spendable = round2(disposable - savingTarget);

    res.json({ ...base, savingRate, savingTarget, spendable, monthOffset });
  } catch (error) {
    console.error('Get budget suggestions error:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
};

// POST /budgets/apply-suggestions  body: { items: [{ categoryId, amount }] }
// Upsert per-categoria: aggiorna il budget attivo della categoria se esiste,
// altrimenti ne crea uno nuovo (MONTHLY, rollover NONE, attivo da oggi).
export const applyBudgetSuggestions = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { items } = req.body as { items?: Array<{ categoryId?: unknown; amount?: unknown }> };

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Nessun budget da applicare' });
    }

    // Dedup per categoria (ultimo vince) + validazione
    const byCat = new Map<string, number>();
    for (const it of items) {
      if (!it || typeof it.categoryId !== 'string' || typeof it.amount !== 'number' || it.amount <= 0) {
        return res.status(400).json({ error: 'Dati non validi' });
      }
      byCat.set(it.categoryId, it.amount);
    }

    const categoryIds = Array.from(byCat.keys());
    const categories = await prisma.category.findMany({
      where: { id: { in: categoryIds }, userId },
      select: { id: true, name: true },
    });
    if (categories.length !== categoryIds.length) {
      return res.status(404).json({ error: 'Categoria non trovata' });
    }
    const catName = new Map(categories.map((c) => [c.id, c.name]));

    const now = new Date();
    const existing = await prisma.budget.findMany({
      where: {
        userId,
        categoryId: { in: categoryIds },
        startDate: { lte: now },
        OR: [{ endDate: null }, { endDate: { gte: now } }],
      },
      select: { id: true, categoryId: true },
    });
    const existingByCat = new Map<string, string>();
    for (const b of existing) {
      if (b.categoryId) existingByCat.set(b.categoryId, b.id);
    }

    const ops = categoryIds.map((categoryId) => {
      const amount = byCat.get(categoryId)!;
      const existingId = existingByCat.get(categoryId);
      if (existingId) {
        return prisma.budget.update({ where: { id: existingId }, data: { amount } });
      }
      return prisma.budget.create({
        data: {
          name: catName.get(categoryId)!,
          amount,
          categoryId,
          period: 'MONTHLY',
          rollover: 'NONE',
          startDate: now,
          userId,
        },
      });
    });

    const result = await prisma.$transaction(ops);
    analyticsCache.delPattern(`budget-suggestions:${userId}`);

    res.status(200).json({ applied: result.length });
  } catch (error) {
    console.error('Apply budget suggestions error:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
};