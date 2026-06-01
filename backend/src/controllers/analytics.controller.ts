import { Response } from 'express';
import prisma from '../utils/prisma';
import { AuthRequest } from '../types';
import { analyticsCache } from '../utils/analyticsCache';
import { countOccurrences } from './dashboard.controller';
import { getAccountsWithBalances, getLiquidBalance, openCCObligations } from '../utils/balance';

const HIST_MONTHS = 3;

export const getForecast = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

    const cacheKey = analyticsCache.keys.forecast(userId);
    const cached = analyticsCache.get<object>(cacheKey);
    if (cached) return res.json(cached);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const daysElapsed = now.getDate();
    const daysInMonth = monthEnd.getDate();
    const daysRemaining = daysInMonth - daysElapsed;

    // Range storico: ultimi HIST_MONTHS mesi (escluso il corrente)
    const histEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    const histStart = new Date(now.getFullYear(), now.getMonth() - HIST_MONTHS, 1, 0, 0, 0, 0);

    // Da domani a fine mese (per calcolare impegni noti rimanenti)
    const tomorrowStart = new Date(now);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);
    tomorrowStart.setHours(0, 0, 0, 0);

    const [
      currentMonthTx,
      historicalTx,
      accounts,
      recurringActive,
      plannedRemaining,
    ] = await Promise.all([
      prisma.transaction.findMany({
        where: { userId, date: { gte: monthStart, lte: now }, fromRecurringId: null },
        include: { category: { select: { id: true, name: true } } },
      }),
      prisma.transaction.findMany({
        where: { userId, date: { gte: histStart, lte: histEnd }, fromRecurringId: null },
        include: { category: { select: { id: true, name: true, icon: true, color: true } } },
      }),
      getAccountsWithBalances(userId),
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

    // ── Saldo corrente = liquidità reale (solo conti BANK, opening balance incluso) ──
    //   Coerente con l'hero e la proiezione: le CC non sono liquidità.
    const currentBalance = await getLiquidBalance(userId, accounts);

    // ── Attuale mese corrente ──
    const actualIncome = currentMonthTx
      .filter((t) => t.type === 'INCOME')
      .reduce((s, t) => s + Number(t.amount), 0);
    const actualExpenses = currentMonthTx
      .filter((t) => t.type === 'EXPENSE')
      .reduce((s, t) => s + Number(t.amount), 0);

    // ── Ritmo giornaliero (fallback per utenti senza storico) ──
    const dailyIncomeRate = daysElapsed > 0 ? actualIncome / daysElapsed : 0;
    const dailyExpenseRate = daysElapsed > 0 ? actualExpenses / daysElapsed : 0;

    // ── Media storica mensile (ultimi HIST_MONTHS mesi) — per display ──
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

    // ── Analisi per categoria: stima spese abituali rimanenti ──
    //
    // Per ogni categoria, calcola la media mensile storica dividendo per HIST_MONTHS
    // (non per i mesi in cui appare): una categoria presente 1/3 dei mesi pesa 1/3.
    // Stima rimanente = max(0, avg_mensile - già_speso_questo_mese).

    type CatInfo = { id?: string; name: string; icon?: string; color?: string };
    const catInfoMap = new Map<string, CatInfo>();
    const histCatMonthMap = new Map<string, Map<string, number>>(); // catKey → monthKey → totale
    const histCatCount = new Map<string, number>();                 // catKey → n. movimenti nello storico

    historicalTx.forEach((t) => {
      if (t.type !== 'EXPENSE') return;
      const catKey = t.categoryId || 'no-category';
      if (!catInfoMap.has(catKey))
        catInfoMap.set(catKey, {
          id: t.categoryId ?? undefined,
          name: t.category?.name || 'Senza categoria',
          icon: t.category?.icon ?? undefined,
          color: t.category?.color ?? undefined,
        });

      histCatCount.set(catKey, (histCatCount.get(catKey) || 0) + 1);

      const d = new Date(t.date);
      const monthKey = `${d.getFullYear()}-${d.getMonth()}`;
      if (!histCatMonthMap.has(catKey)) histCatMonthMap.set(catKey, new Map());
      const mm = histCatMonthMap.get(catKey)!;
      mm.set(monthKey, (mm.get(monthKey) || 0) + Number(t.amount));
    });

    // Media mensile per categoria sull'intera finestra storica
    const catAvgMap = new Map<string, number>();
    histCatMonthMap.forEach((mm, catKey) => {
      const total = Array.from(mm.values()).reduce((s, v) => s + v, 0);
      catAvgMap.set(catKey, total / HIST_MONTHS);
    });

    // ── Spese più frequenti — per NUMERO di movimenti, non per importo ──
    //   Risponde a "quali spese ricorrono spesso" (carburante, supermercato…).
    //   Esclude "Senza categoria": non è una spesa concreta.
    //   perMonth = movimenti/mese; avgMonthly = importo medio mensile (informativo).
    const frequentExpenses = Array.from(histCatCount.entries())
      .filter(([catKey]) => catKey !== 'no-category')
      .map(([catKey, count]) => {
        const info = catInfoMap.get(catKey);
        return {
          categoryId: info?.id,
          categoryName: info?.name || 'Senza categoria',
          icon: info?.icon ?? null,
          color: info?.color ?? null,
          count,
          perMonth: Math.round((count / HIST_MONTHS) * 10) / 10,
          avgMonthly: Math.round((catAvgMap.get(catKey) ?? 0) * 100) / 100,
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    // Spesa mese corrente per categoria (aggiorna anche catInfoMap per categorie nuove)
    const currentCatSpend = new Map<string, number>();
    currentMonthTx.forEach((t) => {
      if (t.type !== 'EXPENSE') return;
      const catKey = t.categoryId || 'no-category';
      if (!catInfoMap.has(catKey))
        catInfoMap.set(catKey, { id: t.categoryId ?? undefined, name: t.category?.name || 'Senza categoria' });
      currentCatSpend.set(catKey, (currentCatSpend.get(catKey) || 0) + Number(t.amount));
    });

    // Stima rimanente per categoria (solo da storico, non nuove categorie del mese corrente)
    let habitualRemainingTotal = 0;
    const habitualCategories: Array<{
      categoryId?: string;
      categoryName: string;
      avgMonthly: number;
      alreadySpent: number;
      estimated: number;
    }> = [];

    catAvgMap.forEach((avg, catKey) => {
      const alreadySpent = currentCatSpend.get(catKey) || 0;
      const estimated = Math.max(0, avg - alreadySpent);
      if (estimated < 0.01) return;
      habitualRemainingTotal += estimated;
      const info = catInfoMap.get(catKey);
      habitualCategories.push({
        categoryId: info?.id,
        categoryName: info?.name || 'Senza categoria',
        avgMonthly: Math.round(avg * 100) / 100,
        alreadySpent: Math.round(alreadySpent * 100) / 100,
        estimated: Math.round(estimated * 100) / 100,
      });
    });

    habitualCategories.sort((a, b) => b.estimated - a.estimated);

    // ── Impegni noti rimanenti ──
    let knownRemainingIncome = 0;
    let knownRemainingExpenses = 0;

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

    for (const p of plannedRemaining) {
      if (p.type === 'INCOME') knownRemainingIncome += Number(p.amount);
      else knownRemainingExpenses += Number(p.amount);
    }

    // Debito CC del ciclo aperto con billing entro fine mese → impegno noto rimanente
    // (currentBalance esclude le CC: lo re-introduciamo come uscita futura).
    if (daysRemaining > 0) {
      const ccDue = openCCObligations(accounts, tomorrowStart, monthEnd, now);
      knownRemainingExpenses += ccDue.total;
    }

    // ── Proiezione ──
    // Spese: stima per categoria se disponibile storico, altrimenti pace giornaliero.
    // Income: solo impegni noti (ricorrenti + pianificate) — il pace income distorce
    // la proiezione quando lo stipendio arriva come importo unico a inizio mese.
    const hasHistoricalData = catAvgMap.size > 0;
    const paceRemainingExpenses = dailyExpenseRate * daysRemaining;
    const forecastedHabitualExpenses = hasHistoricalData
      ? habitualRemainingTotal
      : paceRemainingExpenses;

    const projectedEndBalance =
      currentBalance +
      knownRemainingIncome -
      forecastedHabitualExpenses -
      knownRemainingExpenses;

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
      habitualRemaining: {
        total: Math.round(habitualRemainingTotal * 100) / 100,
        hasData: hasHistoricalData,
        categories: habitualCategories.slice(0, 5),
      },
      frequentExpenses,
      projectedEndBalance: Math.round(projectedEndBalance * 100) / 100,
    };

    analyticsCache.set(cacheKey, result);
    res.json(result);
  } catch (error) {
    console.error('Get forecast error:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
};
