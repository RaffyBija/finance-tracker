import { Response } from 'express';
import prisma from '../utils/prisma';
import { AuthRequest, CreateRecurringTransactionDTO } from '../types';
import { analyticsCache } from '../utils/analyticsCache';
import { accountBelongsToUser, userHasAccounts, ACCOUNT_REQUIRED_ERROR } from '../utils/ownership';
import { reconcileCcChanges, debtContribution } from '../utils/billingCycle';
import { Prisma } from '@prisma/client';

// Voce del promemoria: la ricorrente arricchita con scadenza e ritardo.
type DueItem = { daysOverdue: number } & Record<string, unknown>;

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

export function computeNextDueDate(
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

// Occorrenze SALTATE: quelle dopo lastExecutedDate e prima di `latest` (la scadenza
// corrente, già gestita da computeNextDueDate). Senza lastExecutedDate niente storico
// arretrato: una ricorrente creata con startDate nel passato non deve generare
// mesi di movimenti retroattivi.
const MAX_MISSED = 60;
export function computeMissedDueDates(
  recurring: {
    frequency: string;
    dayOfMonth: number | null;
    startDate: Date;
    endDate: Date | null;
    lastExecutedDate: Date | null;
  },
  latest: Date
): Date[] {
  if (!recurring.lastExecutedDate) return [];
  const last = normalizeDate(recurring.lastExecutedDate);
  const start = normalizeDate(recurring.startDate);
  const end = recurring.endDate ? normalizeDate(recurring.endDate) : null;
  const before = latest.getTime() - 12 * 60 * 60 * 1000; // tolleranza DST
  const out: Date[] = [];
  const push = (d: Date) => {
    if (d > last && d >= start && d.getTime() < before && (!end || d <= end)) out.push(d);
  };

  if (recurring.frequency === 'MONTHLY') {
    const day = recurring.dayOfMonth || 1;
    for (let i = 0; i < 1200 && out.length < MAX_MISSED; i++) {
      const d = clampDay(last.getFullYear(), last.getMonth() + i, day);
      if (d.getTime() >= before) break;
      push(d);
    }
  } else if (recurring.frequency === 'WEEKLY') {
    const skip = Math.max(0, Math.floor((last.getTime() - start.getTime()) / (7 * 86_400_000)) - 1);
    for (let i = skip; i < skip + 5200 && out.length < MAX_MISSED; i++) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7 * i);
      if (d.getTime() >= before) break;
      push(d);
    }
  } else {
    for (let i = 0; i < 200 && out.length < MAX_MISSED; i++) {
      const d = clampDay(last.getFullYear() + i, start.getMonth(), start.getDate());
      if (d.getTime() >= before) break;
      push(d);
    }
  }
  return out;
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

    const where: Prisma.RecurringTransactionWhereInput = { userId };
    
    if (active === 'true') {
      where.isActive = true;
    }

    const recurring = await prisma.recurringTransaction.findMany({
      where,
      include: {
        category: true,
        account: { select: { id: true, name: true, color: true, type: true } },
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
      include: {
        category: true,
        account: { select: { id: true, name: true, color: true, type: true } },
      },
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
      endDate,
      accountId,
    }: CreateRecurringTransactionDTO & { accountId?: string } = req.body;

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

    // Con almeno un conto, il movimento deve averne uno (vedi userHasAccounts).
    if (!accountId && await userHasAccounts(userId)) {
      return res.status(400).json({ error: ACCOUNT_REQUIRED_ERROR });
    }

    if (accountId) {
      const owned = await accountBelongsToUser(accountId, userId);
      if (!owned) {
        return res.status(404).json({ error: 'Conto non trovato' });
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
        ...(accountId && { accountId }),
      },
      include: {
        category: true,
        account: { select: { id: true, name: true, color: true, type: true } },
      },
    });

    analyticsCache.onRecurringMutated(userId);
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
    const { amount, description, categoryId, frequency, dayOfMonth, startDate, endDate, isActive, accountId } = req.body;

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

    // Non si può togliere il conto a un movimento se l'utente ha dei conti.
    if (accountId !== undefined && !accountId && await userHasAccounts(userId)) {
      return res.status(400).json({ error: ACCOUNT_REQUIRED_ERROR });
    }

    if (accountId) {
      const owned = await accountBelongsToUser(accountId, userId);
      if (!owned) {
        return res.status(404).json({ error: 'Conto non trovato' });
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
        ...(accountId !== undefined && { accountId: accountId ?? null }),
      },
      include: {
        category: true,
        account: { select: { id: true, name: true, color: true, type: true } },
      },
    });

    analyticsCache.onRecurringMutated(userId);
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

    analyticsCache.onRecurringMutated(userId);
    res.json({ message: 'Transazione ricorrente eliminata con successo' });
  } catch (error) {
    console.error('Delete recurring transaction error:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
};

// Restituisce le ricorrenti da processare (scadute o in scadenza oggi)
export const getDueRecurring = async (req: AuthRequest, res: Response) => {
  try {
    const userId  = req.userId!;
    const cacheKey = analyticsCache.keys.recurringDue(userId);
    const cached   = analyticsCache.get<object>(cacheKey);
    if (cached) return res.json(cached);

    const today = new Date();

    const recurring = await prisma.recurringTransaction.findMany({
      where: { userId, isActive: true },
      include: { category: true },
    });

    const dueToday: DueItem[] = [];
    const overdue: DueItem[] = [];
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
        // occorrenze arretrate, registrate insieme alla scadenza corrente
        missedCount: computeMissedDueDates(r, dueDate).length,
      };

      if (daysOverdue === 0) dueToday.push(item);
      else overdue.push(item);
    }

    overdue.sort((a, b) => b.daysOverdue - a.daysOverdue);

    const result = { dueToday, overdue };
    analyticsCache.set(cacheKey, result);
    res.json(result);
  } catch (error) {
    console.error('Get due recurring error:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
};

// Crea le transazioni per le ricorrenti selezionate e aggiorna lastExecutedDate
export const executeRecurring = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    // dates (opzionale): { [id]: 'YYYY-MM-DD' } — data EFFETTIVA del movimento se
    // diversa da quella prevista (es. addebito arrivato in ritardo). La scadenza
    // eseguita (lastExecutedDate) resta quella prevista, così il calendario della
    // ricorrente non slitta.
    const { ids, dates } = req.body as { ids: string[]; dates?: Record<string, string> };

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'IDs non validi' });
    }
    if (dates !== undefined && (typeof dates !== 'object' || dates === null
      || Object.values(dates).some((d) => typeof d !== 'string' || isNaN(new Date(d).getTime())))) {
      return res.status(400).json({ error: 'Data non valida' });
    }

    const recurring = await prisma.recurringTransaction.findMany({
      where: { id: { in: ids }, userId, isActive: true },
    });

    if (recurring.length !== ids.length) {
      return res.status(400).json({ error: 'Alcune transazioni ricorrenti non trovate' });
    }

    // Con almeno un conto, nessuna ricorrente senza conto (o su un conto
    // archiviato) può generare movimenti.
    const archivedIds = new Set((await prisma.account.findMany({
      where: { userId, archivedAt: { not: null } },
      select: { id: true },
    })).map((a) => a.id));
    const withoutAccount = recurring.filter((r) => !r.accountId || archivedIds.has(r.accountId));
    if (withoutAccount.length > 0 && await userHasAccounts(userId)) {
      return res.status(400).json({
        error: `Imposta un conto su: ${withoutAccount.map((r) => r.description).join(', ')}`,
      });
    }

    const today = new Date();
    const created = [];

    for (const r of recurring) {
      const dueDate = computeNextDueDate(r, today);
      if (!dueDate) continue;
      // Già eseguita (doppio click, secondo tab, retry): niente duplicato.
      if (r.lastExecutedDate && normalizeDate(r.lastExecutedDate) >= dueDate) continue;

      const occurrences = [
        ...computeMissedDueDates(r, dueDate).map((d) => ({ due: d, date: d })),
        { due: dueDate, date: dates?.[r.id] ? new Date(dates[r.id]) : dueDate },
      ];

      // Tutto o niente per ricorrente; l'update condizionale su lastExecutedDate
      // fa perdere la gara a una seconda richiesta concorrente.
      const txs = await prisma.$transaction(async (tx) => {
        const claimed = await tx.recurringTransaction.updateMany({
          where: { id: r.id, lastExecutedDate: r.lastExecutedDate },
          data: { lastExecutedDate: dueDate },
        });
        if (claimed.count === 0) return [];
        const rows = [];
        for (const o of occurrences) {
          rows.push(await tx.transaction.create({
            data: {
              amount: r.amount,
              type: r.type,
              description: r.description,
              categoryId: r.categoryId,
              date: o.date,
              userId,
              fromRecurringId: r.id,
              ...(r.accountId && { accountId: r.accountId }),
            },
            include: { category: true },
          }));
        }
        return rows;
      });

      for (const t of txs) created.push({ ...t, amount: Number(t.amount) });
    }

    // Una ricorrente su CC datata in un ciclo già chiuso deve aggiornarne l'addebito
    // (stessa regola della creazione manuale di una transazione).
    const ccTouched = await reconcileCcChanges(userId, created.map((t) => ({
      accountId: t.accountId ?? null,
      date: t.date,
      signed: debtContribution(t.type, t.amount),
    })));
    if (ccTouched) analyticsCache.onPlannedMutated(userId);

    analyticsCache.onRecurringExecuted(userId);
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

    const accountOk = recurring.accountId
      ? await accountBelongsToUser(recurring.accountId, userId) // rifiuta i conti archiviati
      : !(await userHasAccounts(userId));
    if (!accountOk) {
      return res.status(400).json({ error: `Imposta un conto su: ${recurring.description}` });
    }

    const today = new Date();
    // Se la scadenza corrente non è ancora registrata (cache client vecchia, card non
    // marcata come "da eseguire"), questo click la salda: segnare la prossima futura
    // la farebbe sparire dai promemoria insieme a quella del mese dopo.
    const pending = computeNextDueDate(recurring, today);
    const hasPending = !!pending
      && (!recurring.lastExecutedDate || normalizeDate(recurring.lastExecutedDate) < pending);
    const dateToMark = hasPending ? pending : (computeNextFutureDueDate(recurring, today) ?? today);

    // Occorrenza già registrata (doppio click, secondo tab): niente duplicato.
    if (recurring.lastExecutedDate && normalizeDate(recurring.lastExecutedDate) >= normalizeDate(dateToMark)) {
      return res.status(409).json({ error: 'Occorrenza già registrata' });
    }

    const transaction = await prisma.$transaction(async (tx) => {
      const claimed = await tx.recurringTransaction.updateMany({
        where: { id: recurringId, lastExecutedDate: recurring.lastExecutedDate },
        data: { lastExecutedDate: dateToMark },
      });
      if (claimed.count === 0) return null;
      return tx.transaction.create({
        data: {
          amount: recurring.amount,
          type: recurring.type,
          description: recurring.description,
          categoryId: recurring.categoryId,
          date: today,
          userId,
          fromRecurringId: recurringId,
          ...(recurring.accountId && { accountId: recurring.accountId }),
        },
        include: { category: true },
      });
    });
    if (!transaction) {
      return res.status(409).json({ error: 'Occorrenza già registrata' });
    }

    analyticsCache.onRecurringExecuted(userId);
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

    analyticsCache.onRecurringMutated(userId);
    res.json(updated);
  } catch (error) {
    console.error('Toggle recurring transaction error:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
};

