import { Response } from 'express';
import prisma from '../utils/prisma';
import { AuthRequest } from '../types';

// Returns all dates a recurring transaction falls on within [monthStart, effectiveEnd]
function getRecurringDatesInMonth(
  rec: {
    frequency: string;
    dayOfMonth?: number | null;
    startDate: Date;
    endDate?: Date | null;
  },
  year: number,
  month: number, // 0-indexed
): Date[] {
  const monthStart = new Date(year, month, 1, 0, 0, 0, 0);
  const monthEnd   = new Date(year, month + 1, 0, 23, 59, 59, 999);
  const effectiveEnd = rec.endDate && rec.endDate < monthEnd ? rec.endDate : monthEnd;

  if (rec.startDate > effectiveEnd) return [];

  const dates: Date[] = [];

  switch (rec.frequency) {
    case 'MONTHLY': {
      const day = rec.dayOfMonth ?? new Date(rec.startDate).getDate();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const effectiveDay = Math.min(day, daysInMonth);
      const d = new Date(year, month, effectiveDay, 12, 0, 0, 0);
      if (d >= rec.startDate && d >= monthStart && d <= effectiveEnd) {
        dates.push(d);
      }
      break;
    }

    case 'WEEKLY': {
      const msPerWeek = 7 * 24 * 60 * 60 * 1000;
      const originTime = rec.startDate.getTime();
      const startTime  = Math.max(monthStart.getTime(), rec.startDate.getTime());
      const endTime    = effectiveEnd.getTime();

      const weeksToStart = Math.ceil((startTime - originTime) / msPerWeek);
      let current = new Date(originTime + Math.max(0, weeksToStart) * msPerWeek);

      while (current.getTime() <= endTime) {
        if (current.getTime() >= monthStart.getTime()) {
          dates.push(new Date(current));
        }
        current = new Date(current.getTime() + msPerWeek);
      }
      break;
    }

    case 'YEARLY': {
      const originMonth = new Date(rec.startDate).getMonth();
      const originDay   = new Date(rec.startDate).getDate();
      if (originMonth !== month) break;
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const effectiveDay = Math.min(originDay, daysInMonth);
      const d = new Date(year, month, effectiveDay, 12, 0, 0, 0);
      if (d >= rec.startDate && d >= monthStart && d <= effectiveEnd) {
        dates.push(d);
      }
      break;
    }
  }

  return dates;
}

const toDateStr = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const getCalendarEvents = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const now    = new Date();
    const year   = req.query.year  ? parseInt(req.query.year  as string) : now.getFullYear();
    const month1 = req.query.month ? parseInt(req.query.month as string) : now.getMonth() + 1;
    const month  = month1 - 1; // 0-indexed for Date constructor

    const monthStart = new Date(year, month,     1,  0,  0,  0,   0);
    const monthEnd   = new Date(year, month + 1, 0, 23, 59, 59, 999);

    const [transactions, plannedTransactions, recurringTransactions, openingBalanceRows] = await Promise.all([
      prisma.transaction.findMany({
        where: { userId, date: { gte: monthStart, lte: monthEnd } },
        include: { category: { select: { id: true, name: true, color: true, icon: true } } },
        orderBy: { date: 'asc' },
      }),
      prisma.plannedTransaction.findMany({
        where: { userId, plannedDate: { gte: monthStart, lte: monthEnd }, isPaid: false },
        include: { category: { select: { id: true, name: true, color: true, icon: true } } },
        orderBy: { plannedDate: 'asc' },
      }),
      prisma.recurringTransaction.findMany({
        where: { userId, isActive: true },
        include: { category: { select: { id: true, name: true, color: true, icon: true } } },
      }),
      prisma.transaction.groupBy({
        by: ['type'],
        where: { userId, date: { lt: monthStart } },
        _sum: { amount: true },
      }),
    ]);

    type DayEvent = {
      id: string;
      source: 'actual' | 'planned' | 'recurring';
      transactionType: 'INCOME' | 'EXPENSE';
      amount: number;
      description: string;
      isPaid?: boolean;
      recurringId?: string;
      category: { id?: string; name: string; color?: string; icon?: string } | null;
    };

    type DayData = { income: number; expenses: number; events: DayEvent[] };

    const days = new Map<string, DayData>();
    const getOrCreate = (key: string) => {
      if (!days.has(key)) days.set(key, { income: 0, expenses: 0, events: [] });
      return days.get(key)!;
    };

    // Actual transactions
    for (const t of transactions) {
      const dateStr = toDateStr(new Date(t.date));
      const day     = getOrCreate(dateStr);
      const amount  = Number(t.amount);
      if (t.type === 'INCOME') day.income   += amount;
      else                     day.expenses += amount;
      day.events.push({
        id: t.id,
        source: 'actual',
        transactionType: t.type,
        amount,
        description: t.description || '',
        category: t.category
          ? { id: t.category.id, name: t.category.name, color: t.category.color ?? undefined, icon: t.category.icon ?? undefined }
          : null,
      });
    }

    // Planned transactions
    for (const p of plannedTransactions) {
      const dateStr = toDateStr(new Date(p.plannedDate));
      const day     = getOrCreate(dateStr);
      const amount  = Number(p.amount);
      if (p.type === 'INCOME') day.income   += amount;
      else                     day.expenses += amount;
      day.events.push({
        id: p.id,
        source: 'planned',
        transactionType: p.type,
        amount,
        description: p.description,
        isPaid: p.isPaid,
        category: p.category
          ? { id: p.category.id, name: p.category.name, color: p.category.color ?? undefined, icon: p.category.icon ?? undefined }
          : null,
      });
    }

    const openingBalance = openingBalanceRows.reduce((sum, row) => {
      const amount = Number(row._sum.amount || 0);
      return row.type === 'INCOME' ? sum + amount : sum - amount;
    }, 0);

    // Build map: recurringId → Set of dateStr where already executed
    // Sources: actual transactions linked via fromRecurringId, and lastExecutedDate
    // (covers executeRecurringNow which writes date=today but marks lastExecutedDate=nextOccurrence)
    const executedDatesPerRec = new Map<string, Set<string>>();
    const ensureSet = (id: string) => {
      if (!executedDatesPerRec.has(id)) executedDatesPerRec.set(id, new Set());
      return executedDatesPerRec.get(id)!;
    };
    for (const t of transactions) {
      if (!t.fromRecurringId) continue;
      ensureSet(t.fromRecurringId).add(toDateStr(new Date(t.date)));
    }
    for (const rec of recurringTransactions) {
      if (!rec.lastExecutedDate) continue;
      ensureSet(rec.id).add(toDateStr(new Date(rec.lastExecutedDate)));
    }

    // Recurring occurrences (only if not already executed on that date)
    for (const rec of recurringTransactions) {
      const occurrences = getRecurringDatesInMonth(
        { frequency: rec.frequency, dayOfMonth: rec.dayOfMonth, startDate: rec.startDate, endDate: rec.endDate },
        year,
        month,
      );
      const executedDates = executedDatesPerRec.get(rec.id) || new Set<string>();

      for (const d of occurrences) {
        const dateStr = toDateStr(d);
        if (executedDates.has(dateStr)) continue;

        const day    = getOrCreate(dateStr);
        const amount = Number(rec.amount);
        if (rec.type === 'INCOME') day.income   += amount;
        else                       day.expenses += amount;
        day.events.push({
          id: `rec-${rec.id}-${dateStr}`,
          source: 'recurring',
          transactionType: rec.type,
          amount,
          description: rec.description,
          recurringId: rec.id,
          category: rec.category
            ? { id: rec.category.id, name: rec.category.name, color: rec.category.color ?? undefined, icon: rec.category.icon ?? undefined }
            : null,
        });
      }
    }

    // Serialize
    const daysObj: Record<string, { income: number; expenses: number; events: DayEvent[] }> = {};
    days.forEach((val, key) => {
      daysObj[key] = {
        income:   Math.round(val.income   * 100) / 100,
        expenses: Math.round(val.expenses * 100) / 100,
        events:   val.events,
      };
    });

    res.json({
      year,
      month: month1,
      days: daysObj,
      openingBalance: Math.round(openingBalance * 100) / 100,
    });
  } catch (error) {
    console.error('Get calendar events error:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
};
