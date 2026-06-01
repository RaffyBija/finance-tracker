import { Response } from 'express';
import prisma from '../utils/prisma';
import { AuthRequest } from '../types';
import { analyticsCache } from '../utils/analyticsCache';
import { getAccountsWithBalances, getLiquidBalance, openCCObligations } from '../utils/balance';

// ── Ottieni il sommario finanziario ───────────────────────────────────────────

export const getSummary = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { startDate, endDate } = req.query;

    const dateFilter: any = {};
    if (startDate) dateFilter.gte = new Date(startDate as string);
    if (endDate)   dateFilter.lte = new Date(endDate as string);

    const where: any = { userId };
    if (Object.keys(dateFilter).length > 0) where.date = dateFilter;

    const [totalIncome, totalExpense, transactionCount] = await Promise.all([
      prisma.transaction.aggregate({ where: { ...where, type: 'INCOME' }, _sum: { amount: true } }),
      prisma.transaction.aggregate({ where: { ...where, type: 'EXPENSE' }, _sum: { amount: true } }),
      prisma.transaction.count({ where }),
    ]);

    const income  = Number(totalIncome._sum.amount  || 0);
    const expense = Number(totalExpense._sum.amount || 0);

    res.json({
      income,
      expense,
      balance: income - expense,
      transactionCount,
      period: {
        startDate: startDate || null,
        endDate:   endDate   || null,
      },
    });
  } catch (error) {
    console.error('Get summary error:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
};

// ── Statistiche per categoria ─────────────────────────────────────────────────

export const getCategoryStats = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { startDate, endDate, type } = req.query;

    const dateFilter: any = {};
    if (startDate) dateFilter.gte = new Date(startDate as string);
    if (endDate)   dateFilter.lte = new Date(endDate as string);

    const where: any = { userId };
    if (Object.keys(dateFilter).length > 0) where.date = dateFilter;
    if (type === 'INCOME' || type === 'EXPENSE') where.type = type;

    const transactions = await prisma.transaction.findMany({
      where,
      include: { category: true },
    });

    const categoryMap = new Map<string, any>();

    transactions.forEach((t) => {
      const key  = t.categoryId || 'uncategorized';
      const name  = t.category?.name  || 'Senza categoria';
      const color = t.category?.color || '#gray';

      if (!categoryMap.has(key)) {
        categoryMap.set(key, { categoryId: t.categoryId, categoryName: name, categoryColor: color, type: t.type, total: 0, count: 0 });
      }

      const stat = categoryMap.get(key);
      stat.total += Number(t.amount);
      stat.count += 1;
    });

    res.json(Array.from(categoryMap.values()).sort((a, b) => b.total - a.total));
  } catch (error) {
    console.error('Get category stats error:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
};

// ── Transazioni recenti ───────────────────────────────────────────────────────

export const getRecentTransactions = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const limit  = req.query.limit ? parseInt(req.query.limit as string) : 10;

    const transactions = await prisma.transaction.findMany({
      where: { userId },
      include: { category: true },
      orderBy: { date: 'desc' },
      take: limit,
    });

    res.json(transactions);
  } catch (error) {
    console.error('Get recent transactions error:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
};

// ── Trend mensile ─────────────────────────────────────────────────────────────

export const getMonthlyTrend = async (req: AuthRequest, res: Response) => {
  try {
    const userId      = req.userId!;
    const monthsCount = parseInt((req.query.months as string) || '6');
    const cacheKey    = analyticsCache.keys.monthlyTrend(userId);

    const cached = analyticsCache.get<object[]>(cacheKey);
    if (cached) return res.json(cached);

    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - monthsCount);

    const transactions = await prisma.transaction.findMany({
      where: { userId, date: { gte: startDate } },
      orderBy: { date: 'asc' },
    });

    const monthlyData = new Map<string, any>();

    transactions.forEach((t) => {
      const d        = new Date(t.date);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

      if (!monthlyData.has(monthKey)) {
        monthlyData.set(monthKey, { month: monthKey, income: 0, expense: 0, balance: 0 });
      }

      const data   = monthlyData.get(monthKey);
      const amount = Number(t.amount);

      if (t.type === 'INCOME') data.income  += amount;
      else                     data.expense += amount;

      data.balance = data.income - data.expense;
    });

    const result = Array.from(monthlyData.values());
    analyticsCache.set(cacheKey, result);
    res.json(result);
  } catch (error) {
    console.error('Get monthly trend error:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
};

// ── Helper: conta le occorrenze reali di una ricorrente in un range ───────────
//
//   Logica:
//   - WEEKLY  → conta quanti lunedì (o qualsiasi giorno settimanale) cadono tra start ed end
//               Semplificato: floor(diffGiorni / 7), con +1 se il giorno di partenza
//               della ricorrente non è stato ancora contato.
//   - MONTHLY → conta i mesi in cui il dayOfMonth cade all'interno di [start, end].
//               Itera mese per mese e verifica se la data costruita è nel range.
//   - YEARLY  → conta gli anni in cui la data anniversario (mese+giorno di startDate
//               della ricorrente) cade all'interno di [start, end].
//
//   Ritorna { occurrences, effectiveAmount } dove effectiveAmount tiene già conto
//   dell'importo unitario × occorrenze.

export function countOccurrences(
  rec: {
    frequency: 'WEEKLY' | 'MONTHLY' | 'YEARLY';
    dayOfMonth: number | null;
    startDate: Date;
    endDate: Date | null;
    amount: any;
  },
  rangeStart: Date,
  rangeEnd: Date,
): number {
  // La ricorrente deve essere attiva almeno in parte nel range
  const recStart = rec.startDate > rangeStart ? rec.startDate : rangeStart;
  const recEnd   = rec.endDate && rec.endDate < rangeEnd ? rec.endDate : rangeEnd;

  if (recStart > recEnd) return 0;

  let occurrences = 0;

  switch (rec.frequency) {
    case 'WEEKLY': {
      // Ogni 7 giorni a partire da rec.startDate originale
      // Troviamo la prima occorrenza >= recStart
      const msPerWeek  = 7 * 24 * 60 * 60 * 1000;
      const originTime = rec.startDate.getTime();
      const startTime  = recStart.getTime();
      const endTime    = recEnd.getTime();

      // Quante settimane intere dall'origine fino a recStart
      const weeksToStart = Math.ceil((startTime - originTime) / msPerWeek);
      let   current      = new Date(originTime + weeksToStart * msPerWeek);

      while (current.getTime() <= endTime) {
        occurrences++;
        current = new Date(current.getTime() + msPerWeek);
      }
      break;
    }

    case 'MONTHLY': {
      // Il giorno del mese è dayOfMonth (es. 5, 10, 20, 30)
      // Itera mese per mese tra recStart e recEnd
      const day = rec.dayOfMonth ?? rec.startDate.getDate();

      const cursor = new Date(recStart.getFullYear(), recStart.getMonth(), 1);
      const endMonth = new Date(recEnd.getFullYear(), recEnd.getMonth(), 1);

      while (cursor <= endMonth) {
        // Gestisce mesi con meno giorni (es. 30 febbraio → ultimo giorno del mese)
        const daysInMonth   = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
        const effectiveDay  = Math.min(day, daysInMonth);
        const occurrence    = new Date(cursor.getFullYear(), cursor.getMonth(), effectiveDay);

        if (occurrence >= recStart && occurrence <= recEnd) {
          occurrences++;
        }

        cursor.setMonth(cursor.getMonth() + 1);
      }
      break;
    }

    case 'YEARLY': {
      // La data anniversario è il mese e giorno di rec.startDate
      const originMonth = rec.startDate.getMonth();
      const originDay   = rec.startDate.getDate();

      const startYear = recStart.getFullYear();
      const endYear   = recEnd.getFullYear();

      for (let year = startYear; year <= endYear; year++) {
        const daysInMonth  = new Date(year, originMonth + 1, 0).getDate();
        const effectiveDay = Math.min(originDay, daysInMonth);
        const occurrence   = new Date(year, originMonth, effectiveDay);

        if (occurrence >= recStart && occurrence <= recEnd) {
          occurrences++;
        }
      }
      break;
    }
  }

  return occurrences;
}

// ── Proiezione saldo (endpoint unificato) ─────────────────────────────────────
//
//   Accetta:
//     ?months=3                                   → da oggi ai prossimi N mesi
//     ?startDate=2025-01-01&endDate=2025-03-31    → range personalizzato

export const getProjectedBalance = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { months, startDate, endDate } = req.query;

    // Chiave cache composita sui parametri della richiesta
    const paramSuffix = months ? `m${months}` : `${startDate}_${endDate}`;
    const cacheKey    = analyticsCache.keys.projectedBalance(userId, paramSuffix);
    const cached      = analyticsCache.get<object>(cacheKey);
    if (cached) return res.json(cached);

    // ── Calcola il range temporale ──
    const now   = new Date();
    let rangeStart: Date;
    let rangeEnd: Date;

    if (startDate && endDate) {
      rangeStart = new Date(startDate as string);
      rangeEnd   = new Date(endDate as string);
    } else if (months) {
      rangeStart = new Date(now);
      rangeEnd   = new Date(now);
      rangeEnd.setMonth(rangeEnd.getMonth() + parseInt(months as string));
    } else {
      return res.status(400).json({ error: 'Fornire months oppure startDate e endDate' });
    }

    // Normalizza a inizio/fine giornata per evitare problemi di orario
    rangeStart.setHours(0, 0, 0, 0);
    rangeEnd.setHours(23, 59, 59, 999);

    if (rangeStart >= rangeEnd) {
      return res.status(400).json({ error: 'La data di inizio deve essere precedente a quella di fine' });
    }

    // ── Saldo corrente = liquidità reale (solo conti BANK, opening balance incluso) ──
    //   Identico al netWorth dell'hero: le CC non sono liquidità e vengono escluse.
    const accounts       = await getAccountsWithBalances(userId);
    const currentBalance = await getLiquidBalance(userId, accounts);

    // ── Ricorrenti attive che si sovrappongono al range ──
    const recurringTransactions = await prisma.recurringTransaction.findMany({
      where: {
        userId,
        isActive: true,
        startDate: { lte: rangeEnd },          // iniziate prima della fine del range
        OR: [
          { endDate: null },
          { endDate: { gte: rangeStart } },    // non ancora terminate all'inizio del range
        ],
      },
    });

    let projectedIncome  = 0;
    let projectedExpense = 0;
    let recurringCount   = 0;  // conta le occorrenze reali, non le ricorrenti

    for (const rec of recurringTransactions) {
      const occurrences = countOccurrences(
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

      if (occurrences === 0) continue;  // nessuna occorrenza nel range → ignora

      recurringCount += occurrences;
      const total = Number(rec.amount) * occurrences;

      if (rec.type === 'INCOME') projectedIncome  += total;
      else                       projectedExpense += total;
    }

    // ── Transazioni pianificate non pagate nel range ──
    const plannedTransactions = await prisma.plannedTransaction.findMany({
      where: {
        userId,
        isPaid: false,
        plannedDate: { gte: rangeStart, lte: rangeEnd },
      },
    });

    let plannedCount = plannedTransactions.length;

    for (const p of plannedTransactions) {
      if (p.type === 'INCOME') projectedIncome  += Number(p.amount);
      else                     projectedExpense += Number(p.amount);
    }

    // ── Debito CC del ciclo ancora aperto → uscita futura al prossimo billing day ──
    //   currentBalance esclude le CC (non è liquidità): qui re-introduciamo il debito
    //   come obbligo futuro, così la proiezione non risulta ottimistica.
    const ccObligations = openCCObligations(accounts, rangeStart, rangeEnd, now);
    projectedExpense += ccObligations.total;

    const result = {
      currentBalance,
      projectedIncome,
      projectedExpense,
      projectedBalance: currentBalance + projectedIncome - projectedExpense,
      recurringCount,
      plannedCount,
    };
    analyticsCache.set(cacheKey, result);
    res.json(result);
  } catch (error) {
    console.error('Get projected balance error:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
};

