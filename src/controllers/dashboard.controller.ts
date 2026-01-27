import { Response } from 'express';
import prisma from '../utils/prisma';
import { AuthRequest } from '../types';

// Ottieni il sommario finanziario
export const getSummary = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { startDate, endDate } = req.query;

    // Build date filter
    const dateFilter: any = {};
    if (startDate) {
      dateFilter.gte = new Date(startDate as string);
    }
    if (endDate) {
      dateFilter.lte = new Date(endDate as string);
    }

    const where: any = { userId };
    if (Object.keys(dateFilter).length > 0) {
      where.date = dateFilter;
    }

    // Calcola totale entrate
    const totalIncome = await prisma.transaction.aggregate({
      where: {
        ...where,
        type: 'INCOME',
      },
      _sum: {
        amount: true,
      },
    });

    // Calcola totale uscite
    const totalExpense = await prisma.transaction.aggregate({
      where: {
        ...where,
        type: 'EXPENSE',
      },
      _sum: {
        amount: true,
      },
    });

    const income = totalIncome._sum.amount || 0;
    const expense = totalExpense._sum.amount || 0;
    const balance = Number(income) - Number(expense);

    // Conta transazioni
    const transactionCount = await prisma.transaction.count({
      where,
    });

    res.json({
      income: Number(income),
      expense: Number(expense),
      balance,
      transactionCount,
      period: {
        startDate: startDate || null,
        endDate: endDate || null,
      },
    });
  } catch (error) {
    console.error('Get summary error:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
};

// Ottieni statistiche per categoria
export const getCategoryStats = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { startDate, endDate, type } = req.query;

    const dateFilter: any = {};
    if (startDate) {
      dateFilter.gte = new Date(startDate as string);
    }
    if (endDate) {
      dateFilter.lte = new Date(endDate as string);
    }

    const where: any = { userId };
    if (Object.keys(dateFilter).length > 0) {
      where.date = dateFilter;
    }
    if (type && (type === 'INCOME' || type === 'EXPENSE')) {
      where.type = type;
    }

    // Raggruppa per categoria
    const transactions = await prisma.transaction.findMany({
      where,
      include: {
        category: true,
      },
    });

    // Aggrega per categoria
    const categoryMap = new Map<string, any>();

    transactions.forEach((transaction) => {
      const categoryKey = transaction.categoryId || 'uncategorized';
      const categoryName = transaction.category?.name || 'Senza categoria';
      const categoryColor = transaction.category?.color || '#gray';

      if (!categoryMap.has(categoryKey)) {
        categoryMap.set(categoryKey, {
          categoryId: transaction.categoryId,
          categoryName,
          categoryColor,
          type: transaction.type,
          total: 0,
          count: 0,
        });
      }

      const stat = categoryMap.get(categoryKey);
      stat.total += Number(transaction.amount);
      stat.count += 1;
    });

    const stats = Array.from(categoryMap.values()).sort((a, b) => b.total - a.total);

    res.json(stats);
  } catch (error) {
    console.error('Get category stats error:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
};

// Ottieni transazioni recenti
export const getRecentTransactions = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;

    const transactions = await prisma.transaction.findMany({
      where: { userId },
      include: {
        category: true,
      },
      orderBy: {
        date: 'desc',
      },
      take: limit,
    });

    res.json(transactions);
  } catch (error) {
    console.error('Get recent transactions error:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
};

// Ottieni trend mensile
export const getMonthlyTrend = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { months = 6 } = req.query;

    const monthsCount = parseInt(months as string);
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - monthsCount);

    const transactions = await prisma.transaction.findMany({
      where: {
        userId,
        date: {
          gte: startDate,
        },
      },
      orderBy: {
        date: 'asc',
      },
    });

    // Raggruppa per mese
    const monthlyData = new Map<string, any>();

    transactions.forEach((transaction) => {
      const date = new Date(transaction.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      if (!monthlyData.has(monthKey)) {
        monthlyData.set(monthKey, {
          month: monthKey,
          income: 0,
          expense: 0,
          balance: 0,
        });
      }

      const data = monthlyData.get(monthKey);
      const amount = Number(transaction.amount);

      if (transaction.type === 'INCOME') {
        data.income += amount;
      } else {
        data.expense += amount;
      }
      data.balance = data.income - data.expense;
    });

    const trend = Array.from(monthlyData.values());

    res.json(trend);
  } catch (error) {
    console.error('Get monthly trend error:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
};

// Ottieni saldo previsto con spese ricorrenti
export const getProjectedBalance = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { months = 3 } = req.query; // Proiezione per i prossimi 3 mesi di default

    // Calcola saldo corrente
    const totalIncome = await prisma.transaction.aggregate({
      where: { userId, type: 'INCOME' },
      _sum: { amount: true },
    });

    const totalExpense = await prisma.transaction.aggregate({
      where: { userId, type: 'EXPENSE' },
      _sum: { amount: true },
    });

    const currentBalance = Number(totalIncome._sum.amount || 0) - Number(totalExpense._sum.amount || 0);

    // Ottieni transazioni ricorrenti attive
    const recurringTransactions = await prisma.recurringTransaction.findMany({
      where: {
        userId,
        isActive: true,
        OR: [
          { endDate: null },
          { endDate: { gte: new Date() } },
        ],
      },
    });

    // Calcola impatto delle spese ricorrenti per i prossimi mesi
    const monthsCount = parseInt(months as string);
    let projectedIncome = 0;
    let projectedExpense = 0;

    recurringTransactions.forEach((rec) => {
      const amount = Number(rec.amount);
      let occurrences = 0;

      switch (rec.frequency) {
        case 'WEEKLY':
          occurrences = monthsCount * 4; // Circa 4 settimane al mese
          break;
        case 'MONTHLY':
          occurrences = monthsCount;
          break;
        case 'YEARLY':
          occurrences = monthsCount / 12;
          break;
      }

      if (rec.type === 'INCOME') {
        projectedIncome += amount * occurrences;
      } else {
        projectedExpense += amount * occurrences;
      }
    });

    // Ottieni transazioni pianificate non pagate nei prossimi mesi
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + monthsCount);

    const plannedTransactions = await prisma.plannedTransaction.findMany({
      where: {
        userId,
        isPaid: false,
        plannedDate: {
          gte: new Date(),
          lte: endDate,
        },
      },
    });

    // Aggiungi le transazioni pianificate alla proiezione
    let plannedIncome = 0;
    let plannedExpense = 0;

    plannedTransactions.forEach((planned) => {
      const amount = Number(planned.amount);
      if (planned.type === 'INCOME') {
        plannedIncome += amount;
      } else {
        plannedExpense += amount;
      }
    });

    projectedIncome += plannedIncome;
    projectedExpense += plannedExpense;

    const projectedBalance = currentBalance + projectedIncome - projectedExpense;

    res.json({
      currentBalance,
      projectedIncome,
      projectedExpense,
      projectedBalance,
      projectionMonths: monthsCount,
      recurringCount: recurringTransactions.length,
      plannedCount: plannedTransactions.length,
    });
  } catch (error) {
    console.error('Get projected balance error:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
};