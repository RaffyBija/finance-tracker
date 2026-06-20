import { Response } from 'express';
import prisma from '../utils/prisma';
import { AuthRequest, CreateBudgetDTO } from '../types';

// Spesa di un budget nel suo periodo. Tiene conto delle transazioni divise (split):
// - budget globale (senza categoria) → somma di tutte le uscite (l'importo del padre
//   coincide con la somma delle righe, quindi il totale è corretto);
// - budget di categoria → uscite semplici con quella categoria + righe split con quella
//   categoria (i cui padri sono uscite nel periodo). I padri split hanno categoryId null,
//   quindi non vengono mai contati due volte.
const computeBudgetSpent = async (
  userId: string,
  budget: { categoryId: string | null; startDate: Date; endDate: Date | null },
): Promise<number> => {
  const dateFilter = { gte: budget.startDate, ...(budget.endDate && { lte: budget.endDate }) };
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

    // Calcola spesa corrente per ogni budget
    const budgetsWithSpent = await Promise.all(
      budgets.map(async (budget) => {
        const spent = await computeBudgetSpent(userId, budget);

        return {
          ...budget,
          spent,
          remaining: Number(budget.amount) - spent,
          percentage: (spent / Number(budget.amount)) * 100,
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

    // Calcola spesa corrente
    const spent = await computeBudgetSpent(userId, budget);

    const budgetWithSpent = {
      ...budget,
      spent,
      remaining: Number(budget.amount) - spent,
      percentage: (spent / Number(budget.amount)) * 100,
    };

    res.json(budgetWithSpent);
  } catch (error) {
    console.error('Get budget error:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
};

// Crea un budget
export const createBudget = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { name, amount, categoryId, period, startDate, endDate }: CreateBudgetDTO = req.body;

    if (!name || !amount || amount <= 0 || !period || !startDate) {
      return res.status(400).json({ error: 'Dati non validi' });
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
    const { name, amount, categoryId, period, startDate, endDate } = req.body;

    const existingBudget = await prisma.budget.findFirst({
      where: { id, userId },
    });

    if (!existingBudget) {
      return res.status(404).json({ error: 'Budget non trovato' });
    }

    if (amount !== undefined && amount <= 0) {
      return res.status(400).json({ error: 'Importo non valido' });
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