import { Response } from 'express';
import prisma from '../utils/prisma';
import { AuthRequest } from '../types';
import { analyticsCache } from '../utils/analyticsCache';
import { countOccurrences } from './dashboard.controller';

// ── Forecast fine mese ────────────────────────────────────────────────────────
//
//   Proiezione saldo a fine mese corrente combinando:
//   1. Saldo attuale (tutte le transazioni storiche)
//   2. Ritmo di spesa/entrata del mese corrente (daily pace × giorni rimanenti)
//   3. Impegni noti rimanenti (ricorrenti + pianificate non ancora eseguite/pagate)
//   4. Media storica ultimi 3 mesi (per contesto)

export const getForecast = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

    const cacheKey = analyticsCache.keys.forecast(userId);
    const cached = analyticsCache.get<object>(cacheKey);
    if (cached) return res.json(cached);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthStart2 = new Date(now.getFullYear(), now.getMonth(), 1);
    monthStart2.setHours(0, 0, 0, 0);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const daysElapsed = now.getDate();
    const daysInMonth = monthEnd.getDate();
    const daysRemaining = daysInMonth - daysElapsed;

    // Range storico: ultimi 3 mesi (escluso il corrente)
    const histEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    const histStart = new Date(now.getFullYear(), now.getMonth() - 3, 1);
    histStart.setHours(0, 0, 0, 0);

    // Da domani a fine mese (per calcolare impegni noti rimanenti)
    const tomorrowStart = new Date(now);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);
    tomorrowStart.setHours(0, 0, 0, 0);

    const [
      currentMonthTx,
      historicalTx,
      incAgg,
      expAgg,
      recurringActive,
      plannedRemaining,
    ] = await Promise.all([
      prisma.transaction.findMany({
        where: { userId, date: { gte: monthStart2, lte: now } },
      }),
      prisma.transaction.findMany({
        where: { userId, date: { gte: histStart, lte: histEnd } },
      }),
      prisma.transaction.aggregate({
        where: { userId, type: 'INCOME' },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: { userId, type: 'EXPENSE' },
        _sum: { amount: true },
      }),
      prisma.recurringTransaction.findMany({
        where: { userId, isActive: true },
      }),
      prisma.plannedTransaction.findMany({
        where: {
          userId,
          isPaid: false,
          plannedDate: { gte: tomorrowStart, lte: monthEnd },
        },
      }),
    ]);

    // ── Saldo corrente (all-time) ──
    const currentBalance =
      Number(incAgg._sum.amount || 0) - Number(expAgg._sum.amount || 0);

    // ── Attuale mese corrente ──
    const actualIncome = currentMonthTx
      .filter((t) => t.type === 'INCOME')
      .reduce((s, t) => s + Number(t.amount), 0);
    const actualExpenses = currentMonthTx
      .filter((t) => t.type === 'EXPENSE')
      .reduce((s, t) => s + Number(t.amount), 0);

    // ── Ritmo giornaliero ──
    const dailyIncomeRate = daysElapsed > 0 ? actualIncome / daysElapsed : 0;
    const dailyExpenseRate = daysElapsed > 0 ? actualExpenses / daysElapsed : 0;

    // ── Media storica mensile (ultimi 3 mesi) ──
    const histMonthMap = new Map<string, { income: number; expenses: number }>();
    historicalTx.forEach((t) => {
      const d = new Date(t.date);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (!histMonthMap.has(key)) histMonthMap.set(key, { income: 0, expenses: 0 });
      const m = histMonthMap.get(key)!;
      if (t.type === 'INCOME') m.income += Number(t.amount);
      else m.expenses += Number(t.amount);
    });
    const histMonths = Array.from(histMonthMap.values());
    const histCount = histMonths.length || 1;
    const histAvgIncome = histMonths.reduce((s, m) => s + m.income, 0) / histCount;
    const histAvgExpenses = histMonths.reduce((s, m) => s + m.expenses, 0) / histCount;

    // ── Impegni noti rimanenti ──
    let knownRemainingIncome = 0;
    let knownRemainingExpenses = 0;

    // Ricorrenti attive: quante occorrenze tra domani e fine mese
    if (daysRemaining > 0) {
      for (const rec of recurringActive) {
        const occ = countOccurrences(
          {
            frequency: rec.frequency as 'WEEKLY' | 'MONTHLY' | 'YEARLY',
            dayOfMonth: rec.dayOfMonth,
            startDate: rec.startDate,
            endDate: rec.endDate,
            amount: rec.amount,
          },
          tomorrowStart,
          monthEnd,
        );
        if (occ === 0) continue;
        const total = occ * Number(rec.amount);
        if (rec.type === 'INCOME') knownRemainingIncome += total;
        else knownRemainingExpenses += total;
      }
    }

    // Pianificate non pagate rimanenti
    for (const p of plannedRemaining) {
      if (p.type === 'INCOME') knownRemainingIncome += Number(p.amount);
      else knownRemainingExpenses += Number(p.amount);
    }

    // ── Proiezione ──
    // Income: solo impegni noti (ricorrenti + pianificate), non il pace giornaliero.
    // Il pace income distorce la proiezione quando lo stipendio arriva a inizio mese
    // come importo unico — il tasso giornaliero risulterebbe gonfiato e verrebbe
    // proiettato in avanti in modo non realistico.
    const paceRemainingExpenses = dailyExpenseRate * daysRemaining;

    const projectedEndBalance =
      currentBalance +
      knownRemainingIncome -
      paceRemainingExpenses - knownRemainingExpenses;

    const result = {
      daysElapsed,
      daysInMonth,
      daysRemaining,
      currentBalance,
      currentMonthActual: {
        income: Math.round(actualIncome * 100) / 100,
        expenses: Math.round(actualExpenses * 100) / 100,
      },
      dailyPace: {
        income: Math.round(dailyIncomeRate * 100) / 100,
        expenses: Math.round(dailyExpenseRate * 100) / 100,
      },
      knownRemaining: {
        income: Math.round(knownRemainingIncome * 100) / 100,
        expenses: Math.round(knownRemainingExpenses * 100) / 100,
      },
      historicalAvg: {
        income: Math.round(histAvgIncome * 100) / 100,
        expenses: Math.round(histAvgExpenses * 100) / 100,
        monthsConsidered: histCount,
      },
      projectedEndBalance: Math.round(projectedEndBalance * 100) / 100,
    };

    analyticsCache.set(cacheKey, result);
    res.json(result);
  } catch (error) {
    console.error('Get forecast error:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
};
