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
  const windows = recentBudgetWindows(budget.period, MAX_ROLLOVER_PERIODS).filter(
    (w) =>
      w.periodEnd < current.periodStart && // solo periodi precedenti a quello corrente
      w.periodEnd >= budget.startDate && // budget già attivo
      (!budget.endDate || w.periodStart <= budget.endDate),
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

    if (categoryId) {
      const category = await prisma.category.findFirst({
        where: { id: categoryId, userId },
      });
      if (!category) {
        return res.status(404).json({ error: 'Categoria non trovata' });
      }
    }

    const budget = await prisma.budget.create({
      data: {
        name,
        amount,
        categoryId,
        period,
        rollover: rollover ?? 'NONE',
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        userId,
      },
      include: { category: true },
    });

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

    if (categoryId) {
      const category = await prisma.category.findFirst({
        where: { id: categoryId, userId },
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
        ...(categoryId !== undefined && { categoryId }),
        ...(period && { period }),
        ...(rollover !== undefined && { rollover }),
        ...(startDate && { startDate: new Date(startDate) }),
        ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
      },
      include: { category: true },
    });

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

    res.json({ message: 'Budget eliminato con successo' });
  } catch (error) {
    console.error('Delete budget error:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
};