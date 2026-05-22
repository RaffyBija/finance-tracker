import { Response } from 'express';
import prisma from '../utils/prisma';
import { AuthRequest, CreateRecurringTransactionDTO } from '../types';

// ── Due date helpers ─────────────────────────────────────────────────────────

function normalizeDate(d: Date): Date {
  const n = new Date(d);
  n.setHours(0, 0, 0, 0);
  return n;
}

function clampDay(year: number, month: number, day: number): Date {
  const lastDay = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(day, lastDay));
}

function computeNextDueDate(
  recurring: {
    frequency: string;
    dayOfMonth: number | null;
    startDate: Date;
    endDate: Date | null;
  },
  today: Date
): Date | null {
  const start = normalizeDate(recurring.startDate);
  const todayN = normalizeDate(today);

  if (start > todayN) return null;

  let dueDate: Date;

  if (recurring.frequency === 'MONTHLY') {
    const day = recurring.dayOfMonth || 1;
    const thisMonthDue = clampDay(todayN.getFullYear(), todayN.getMonth(), day);

    if (thisMonthDue <= todayN && thisMonthDue >= start) {
      dueDate = thisMonthDue;
    } else {
      const pm = todayN.getMonth() === 0
        ? clampDay(todayN.getFullYear() - 1, 11, day)
        : clampDay(todayN.getFullYear(), todayN.getMonth() - 1, day);
      dueDate = pm >= start ? pm : start;
    }
  } else if (recurring.frequency === 'WEEKLY') {
    const MS_WEEK = 7 * 24 * 60 * 60 * 1000;
    const weeks = Math.floor((todayN.getTime() - start.getTime()) / MS_WEEK);
    dueDate = new Date(start.getTime() + weeks * MS_WEEK);
  } else {
    // YEARLY
    const thisYear = new Date(todayN.getFullYear(), start.getMonth(), start.getDate());
    if (thisYear <= todayN && thisYear >= start) {
      dueDate = thisYear;
    } else {
      const prevYear = new Date(todayN.getFullYear() - 1, start.getMonth(), start.getDate());
      dueDate = prevYear >= start ? prevYear : start;
    }
  }

  if (recurring.endDate) {
    const end = normalizeDate(recurring.endDate);
    if (dueDate > end) return null;
  }

  return dueDate;
}

// Ritorna la prossima occorrenza >= oggi (usata per execute-now)
function computeNextFutureDueDate(
  recurring: {
    frequency: string;
    dayOfMonth: number | null;
    startDate: Date;
    endDate: Date | null;
  },
  today: Date
): Date | null {
  const start = normalizeDate(recurring.startDate);
  const todayN = normalizeDate(today);
  let dueDate: Date;

  if (recurring.frequency === 'MONTHLY') {
    const day = recurring.dayOfMonth || 1;
    const thisMonthDue = clampDay(todayN.getFullYear(), todayN.getMonth(), day);
    if (thisMonthDue >= todayN) {
      dueDate = thisMonthDue;
    } else {
      dueDate = todayN.getMonth() === 11
        ? clampDay(todayN.getFullYear() + 1, 0, day)
        : clampDay(todayN.getFullYear(), todayN.getMonth() + 1, day);
    }
  } else if (recurring.frequency === 'WEEKLY') {
    const MS_WEEK = 7 * 24 * 60 * 60 * 1000;
    if (start >= todayN) {
      dueDate = start;
    } else {
      const weeks = Math.floor((todayN.getTime() - start.getTime()) / MS_WEEK);
      const lastOcc = new Date(start.getTime() + weeks * MS_WEEK);
      dueDate = lastOcc.getTime() === todayN.getTime()
        ? lastOcc
        : new Date(start.getTime() + (weeks + 1) * MS_WEEK);
    }
  } else {
    // YEARLY
    const thisYear = new Date(todayN.getFullYear(), start.getMonth(), start.getDate());
    dueDate = thisYear >= todayN
      ? thisYear
      : new Date(todayN.getFullYear() + 1, start.getMonth(), start.getDate());
  }

  if (recurring.endDate) {
    const end = normalizeDate(recurring.endDate);
    if (dueDate > end) return null;
  }

  return dueDate;
}

// Ottieni tutte le transazioni ricorrenti
export const getRecurringTransactions = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { active } = req.query;

    const where: any = { userId };
    
    if (active === 'true') {
      where.isActive = true;
    }

    const recurring = await prisma.recurringTransaction.findMany({
      where,
      include: {
        category: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.json(recurring);
  } catch (error) {
    console.error('Get recurring transactions error:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
};

// Ottieni una transazione ricorrente
export const getRecurringTransaction = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { id } = req.params;
    const fixedId = Array.isArray(id) ? id[0] : id;

    const recurring = await prisma.recurringTransaction.findFirst({
      where: { id: fixedId, userId },
      include: { category: true },
    });

    if (!recurring) {
      return res.status(404).json({ error: 'Transazione ricorrente non trovata' });
    }

    res.json(recurring);
  } catch (error) {
    console.error('Get recurring transaction error:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
};

// Crea una transazione ricorrente
export const createRecurringTransaction = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { 
      amount, 
      type, 
      description, 
      categoryId, 
      frequency, 
      dayOfMonth, 
      startDate, 
      endDate 
    }: CreateRecurringTransactionDTO = req.body;

    if (!amount || amount <= 0 || !type || !description || !frequency || !startDate) {
      return res.status(400).json({ error: 'Dati non validi' });
    }

    if (type !== 'INCOME' && type !== 'EXPENSE') {
      return res.status(400).json({ error: 'Tipo non valido' });
    }

    if (frequency === 'MONTHLY' && (!dayOfMonth || dayOfMonth < 1 || dayOfMonth > 31)) {
      return res.status(400).json({ error: 'Giorno del mese non valido (1-31)' });
    }

    if (categoryId) {
      const category = await prisma.category.findFirst({
        where: { id: categoryId, userId },
      });
      if (!category) {
        return res.status(404).json({ error: 'Categoria non trovata' });
      }
      if (category.type !== type) {
        return res.status(400).json({ error: 'Il tipo della categoria non corrisponde' });
      }
    }

    const recurring = await prisma.recurringTransaction.create({
      data: {
        amount,
        type,
        description,
        categoryId,
        frequency,
        dayOfMonth: frequency === 'MONTHLY' ? dayOfMonth : null,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        userId,
      },
      include: { category: true },
    });

    res.status(201).json(recurring);
  } catch (error) {
    console.error('Create recurring transaction error:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
};

// Aggiorna una transazione ricorrente
export const updateRecurringTransaction = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { id } = req.params;
    const { amount, description, categoryId, frequency, dayOfMonth, startDate, endDate, isActive } = req.body;

    const fixedId = Array.isArray(id) ? id[0] : id;

    const existing = await prisma.recurringTransaction.findFirst({
      where: { id: fixedId, userId },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Transazione ricorrente non trovata' });
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
      if (category.type !== existing.type) {
        return res.status(400).json({ error: 'Il tipo della categoria non corrisponde' });
      }
    }

    const recurring = await prisma.recurringTransaction.update({
      where: { id: fixedId },
      data: {
        ...(amount !== undefined && { amount }),
        ...(description && { description }),
        ...(categoryId !== undefined && { categoryId }),
        ...(frequency && { frequency }),
        ...(dayOfMonth !== undefined && { dayOfMonth }),
        ...(startDate && { startDate: new Date(startDate) }),
        ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
        ...(isActive !== undefined && { isActive }),
      },
      include: { category: true },
    });

    res.json(recurring);
  } catch (error) {
    console.error('Update recurring transaction error:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
};

// Elimina una transazione ricorrente
export const deleteRecurringTransaction = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { id }= req.params;
    const transactionId = Array.isArray(id) ? id[0] : id;

    const recurring = await prisma.recurringTransaction.findFirst({
      where: { id: transactionId, userId },
    });

    if (!recurring) {
      return res.status(404).json({ error: 'Transazione ricorrente non trovata' });
    }

    await prisma.recurringTransaction.delete({ where: { id: transactionId } });

    res.json({ message: 'Transazione ricorrente eliminata con successo' });
  } catch (error) {
    console.error('Delete recurring transaction error:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
};

// Restituisce le ricorrenti da processare (scadute o in scadenza oggi)
export const getDueRecurring = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const today = new Date();

    const recurring = await prisma.recurringTransaction.findMany({
      where: { userId, isActive: true },
      include: { category: true },
    });

    const dueToday: object[] = [];
    const overdue: object[] = [];
    const MS_DAY = 24 * 60 * 60 * 1000;

    for (const r of recurring) {
      const dueDate = computeNextDueDate(r, today);
      if (!dueDate) continue;

      const lastExec = r.lastExecutedDate ? normalizeDate(r.lastExecutedDate) : null;
      if (lastExec && lastExec >= dueDate) continue;

      const daysOverdue = Math.floor((normalizeDate(today).getTime() - dueDate.getTime()) / MS_DAY);

      const item = {
        ...r,
        amount: Number(r.amount),
        nextDueDate: dueDate.toISOString().split('T')[0],
        daysOverdue,
      };

      if (daysOverdue === 0) dueToday.push(item);
      else overdue.push(item);
    }

    overdue.sort((a: any, b: any) => b.daysOverdue - a.daysOverdue);

    res.json({ dueToday, overdue });
  } catch (error) {
    console.error('Get due recurring error:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
};

// Crea le transazioni per le ricorrenti selezionate e aggiorna lastExecutedDate
export const executeRecurring = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { ids } = req.body as { ids: string[] };

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'IDs non validi' });
    }

    const recurring = await prisma.recurringTransaction.findMany({
      where: { id: { in: ids }, userId, isActive: true },
    });

    if (recurring.length !== ids.length) {
      return res.status(400).json({ error: 'Alcune transazioni ricorrenti non trovate' });
    }

    const today = new Date();
    const created = [];

    for (const r of recurring) {
      const dueDate = computeNextDueDate(r, today);
      if (!dueDate) continue;

      const transaction = await prisma.transaction.create({
        data: {
          amount: r.amount,
          type: r.type,
          description: r.description,
          categoryId: r.categoryId,
          date: dueDate,
          userId,
        },
        include: { category: true },
      });

      await prisma.recurringTransaction.update({
        where: { id: r.id },
        data: { lastExecutedDate: dueDate },
      });

      created.push({ ...transaction, amount: Number(transaction.amount) });
    }

    res.status(201).json({ created, count: created.length });
  } catch (error) {
    console.error('Execute recurring error:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
};

// Crea la transazione per oggi e segna la prossima occorrenza futura come eseguita
export const executeRecurringNow = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const recurringId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const recurring = await prisma.recurringTransaction.findFirst({
      where: { id: recurringId, userId, isActive: true },
    });

    if (!recurring) {
      return res.status(404).json({ error: 'Transazione ricorrente non trovata' });
    }

    const today = new Date();
    const nextFuture = computeNextFutureDueDate(recurring, today);
    const dateToMark = nextFuture ?? today;

    const transaction = await prisma.transaction.create({
      data: {
        amount: recurring.amount,
        type: recurring.type,
        description: recurring.description,
        categoryId: recurring.categoryId,
        date: today,
        userId,
      },
      include: { category: true },
    });

    await prisma.recurringTransaction.update({
      where: { id: recurringId },
      data: { lastExecutedDate: dateToMark },
    });

    res.status(201).json({ ...transaction, amount: Number(transaction.amount) });
  } catch (error) {
    console.error('Execute recurring now error:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
};

// Toggle attivo/inattivo
export const toggleRecurringTransaction = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { id } = req.params;
    const transactionId = Array.isArray(id) ? id[0] : id;

    const recurring = await prisma.recurringTransaction.findFirst({
      where: { id: transactionId, userId },
    });

    if (!recurring) {
      return res.status(404).json({ error: 'Transazione ricorrente non trovata' });
    }

    const updated = await prisma.recurringTransaction.update({
      where: { id: transactionId },
      data: { isActive: !recurring.isActive },
      include: { category: true },
    });

    res.json(updated);
  } catch (error) {
    console.error('Toggle recurring transaction error:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
};

