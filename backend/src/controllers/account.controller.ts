import { Response } from 'express';
import prisma from '../utils/prisma';
import { AuthRequest } from '../types';
import { analyticsCache } from '../utils/analyticsCache';
import {
  currentCycleWindow,
  effectiveClosingDay,
  computeCycleDebt,
  ensureOpenCycle,
  syncCyclePlanned,
  cycleLabel,
  nextBillingDate,
} from '../utils/billingCycle';
import { getAccountsWithBalances } from '../utils/balance';

const MAX_FREE_ACCOUNTS = 3;
const MAX_PRO_ACCOUNTS  = 10;

export const getAccounts = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

    const accounts = await prisma.account.findMany({
      where: { userId },
      include: {
        _count: { select: { transactions: true } },
        linkedAccount: { select: { id: true, name: true } },
        linkedCC: { select: { id: true, name: true, color: true } },
      },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });

    // Calcola saldi con una sola query groupBy invece di N*2 aggregate
    const accountIds = accounts.map((a) => a.id);
    const totals = await prisma.transaction.groupBy({
      by: ['accountId', 'type'],
      where: { accountId: { in: accountIds } },
      _sum: { amount: true },
    });

    const balanceMap: Record<string, { income: number; expense: number }> = {};
    for (const row of totals) {
      if (!row.accountId) continue;
      if (!balanceMap[row.accountId]) balanceMap[row.accountId] = { income: 0, expense: 0 };
      if (row.type === 'INCOME') balanceMap[row.accountId].income = Number(row._sum.amount ?? 0);
      if (row.type === 'EXPENSE') balanceMap[row.accountId].expense = Number(row._sum.amount ?? 0);
    }

    // Per le CC il saldo è il debito del solo ciclo OPEN corrente (i cicli chiusi
    // sono già diventati pianificate): finestra basata su closingDay.
    const ccDebt: Record<string, number> = {};
    await Promise.all(
      accounts
        .filter((a) => a.type === 'CREDIT_CARD')
        .map(async (a) => {
          const { periodStart, periodEnd } = currentCycleWindow(effectiveClosingDay(a));
          ccDebt[a.id] = await computeCycleDebt(a.id, periodStart, periodEnd);
        }),
    );

    const accountsWithBalance = accounts.map((account) => {
      let balance: number;
      if (account.type === 'CREDIT_CARD') {
        // openingBalance = debito iniziale residuo; debito del ciclo aperto positivo
        balance = -Number(account.openingBalance) - (ccDebt[account.id] ?? 0);
      } else {
        const { income = 0, expense = 0 } = balanceMap[account.id] ?? {};
        balance = Number(account.openingBalance) + income - expense;
      }
      return {
        ...account,
        openingBalance: Number(account.openingBalance),
        creditLimit: account.creditLimit ? Number(account.creditLimit) : null,
        balance,
      };
    });

    res.json(accountsWithBalance);
  } catch (error) {
    console.error('Get accounts error:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
};

export const getAccount = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const account = await prisma.account.findFirst({
      where: { id, userId },
      include: {
        linkedAccount: { select: { id: true, name: true } },
        linkedCC: {
          select: {
            id: true, name: true, color: true, type: true,
            creditLimit: true, billingDay: true, closingDay: true, openingBalance: true,
          },
        },
      },
    });

    if (!account) {
      return res.status(404).json({ error: 'Conto non trovato' });
    }

    // Saldi calcolati centralizzati (stessa logica della lista): mappa id → balance.
    const balances = await getAccountsWithBalances(userId);
    const balanceById = new Map(balances.map((b) => [b.id, b.balance]));

    res.json({
      ...account,
      openingBalance: Number(account.openingBalance),
      creditLimit: account.creditLimit ? Number(account.creditLimit) : null,
      balance: balanceById.get(account.id) ?? 0,
      linkedCC: account.linkedCC.map((cc) => ({
        ...cc,
        openingBalance: Number(cc.openingBalance),
        creditLimit: cc.creditLimit ? Number(cc.creditLimit) : null,
        balance: balanceById.get(cc.id) ?? 0,
      })),
    });
  } catch (error) {
    console.error('Get account error:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
};

export const createAccount = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { name, type, color, icon, openingBalance, creditLimit, billingDay, closingDay, linkedAccountId } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({ error: 'Nome conto obbligatorio' });
    }
    if (!type || (type !== 'BANK' && type !== 'CREDIT_CARD')) {
      return res.status(400).json({ error: 'Tipo non valido (BANK o CREDIT_CARD)' });
    }
    if (type === 'CREDIT_CARD' && billingDay !== undefined) {
      const day = Number(billingDay);
      if (!Number.isInteger(day) || day < 1 || day > 31) {
        return res.status(400).json({ error: 'Giorno di addebito non valido (1–31)' });
      }
    }

    const user  = await prisma.user.findUnique({ where: { id: userId }, select: { isPro: true } });
    const limit = user?.isPro ? MAX_PRO_ACCOUNTS : MAX_FREE_ACCOUNTS;
    const count = await prisma.account.count({ where: { userId } });
    if (count >= limit) {
      return res.status(403).json({ error: 'Limite account raggiunto', upgrade: !user?.isPro, limit });
    }

    const existing = await prisma.account.findFirst({ where: { userId, name: name.trim() } });
    if (existing) {
      return res.status(409).json({ error: 'Esiste già un conto con questo nome' });
    }

    if (linkedAccountId) {
      const linked = await prisma.account.findFirst({ where: { id: linkedAccountId, userId } });
      if (!linked) {
        return res.status(400).json({ error: 'Conto collegato non trovato' });
      }
    }

    const account = await prisma.account.create({
      data: {
        userId,
        name: name.trim(),
        type,
        color: color ?? '#0d9488',
        icon: icon ?? null,
        openingBalance: openingBalance ?? 0,
        creditLimit:  type === 'CREDIT_CARD' && creditLimit  ? creditLimit          : null,
        billingDay:   type === 'CREDIT_CARD' && billingDay   ? Number(billingDay)   : null,
        closingDay:   type === 'CREDIT_CARD' && closingDay   ? Number(closingDay)   : null,
        linkedAccountId: type === 'CREDIT_CARD' && linkedAccountId ? linkedAccountId : null,
      },
    });

    res.status(201).json({
      ...account,
      openingBalance: Number(account.openingBalance),
      creditLimit: account.creditLimit ? Number(account.creditLimit) : null,
    });
  } catch (error) {
    console.error('Create account error:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
};

export const updateAccount = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    // openingBalance NON è modificabile: è la configurazione di partenza. Il saldo si
    // cambia solo con transazioni, così resta tracciabile e non manipolabile a forza.
    const { name, color, icon, creditLimit, billingDay, closingDay, linkedAccountId } = req.body;

    const existing = await prisma.account.findFirst({ where: { id, userId } });
    if (!existing) {
      return res.status(404).json({ error: 'Conto non trovato' });
    }

    if (name && name.trim() !== existing.name) {
      const duplicate = await prisma.account.findFirst({
        where: { userId, name: name.trim(), id: { not: id } },
      });
      if (duplicate) {
        return res.status(409).json({ error: 'Esiste già un conto con questo nome' });
      }
    }

    if (billingDay !== undefined) {
      const day = Number(billingDay);
      if (!Number.isInteger(day) || day < 1 || day > 31) {
        return res.status(400).json({ error: 'Giorno di addebito non valido (1–31)' });
      }
    }

    if (linkedAccountId) {
      const linked = await prisma.account.findFirst({ where: { id: linkedAccountId, userId } });
      if (!linked) {
        return res.status(400).json({ error: 'Conto collegato non trovato' });
      }
    }

    const account = await prisma.account.update({
      where: { id },
      data: {
        ...(name && { name: name.trim() }),
        ...(color !== undefined && { color }),
        ...(icon !== undefined && { icon }),
        ...(creditLimit !== undefined && { creditLimit: creditLimit ?? null }),
        ...(billingDay  !== undefined && { billingDay:  billingDay  ? Number(billingDay)  : null }),
        ...(closingDay  !== undefined && { closingDay:  closingDay  ? Number(closingDay)  : null }),
        ...(linkedAccountId !== undefined && { linkedAccountId: linkedAccountId ?? null }),
      },
    });

    res.json({
      ...account,
      openingBalance: Number(account.openingBalance),
      creditLimit: account.creditLimit ? Number(account.creditLimit) : null,
    });
  } catch (error) {
    console.error('Update account error:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
};

export const deleteAccount = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const account = await prisma.account.findFirst({ where: { id, userId } });
    if (!account) {
      return res.status(404).json({ error: 'Conto non trovato' });
    }
    if (account.isDefault) {
      return res.status(400).json({ error: 'Il conto principale non può essere eliminato' });
    }

    // Le transazioni collegate vengono impostate a NULL (onDelete: SetNull)
    await prisma.account.delete({ where: { id } });

    res.json({ message: 'Conto eliminato con successo' });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
};

export const settleAccount = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const account = await prisma.account.findFirst({ where: { id, userId } });
    if (!account) return res.status(404).json({ error: 'Conto non trovato' });
    if (account.type !== 'CREDIT_CARD') return res.status(400).json({ error: 'Solo le carte di credito possono essere saldate' });
    if (!account.linkedAccountId) return res.status(400).json({ error: 'Nessun conto bancario collegato per l\'addebito' });

    const linkedAccount = await prisma.account.findFirst({ where: { id: account.linkedAccountId, userId } });
    if (!linkedAccount) return res.status(400).json({ error: 'Conto collegato non trovato' });

    const now = new Date();
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    // Salda i pagamenti dovuti: le pianificate di billing dei cicli CHIUSI non
    // ancora pagate e scadute (plannedDate ≤ oggi).
    const duePlanned = await prisma.plannedTransaction.findMany({
      where: { userId, ccAccountId: account.id, isPaid: false, plannedDate: { lte: endOfToday } },
    });

    const debtAmount = duePlanned.reduce((sum, p) => sum + Number(p.amount), 0);
    if (debtAmount <= 0) return res.status(400).json({ error: 'Nessun addebito da saldare' });

    const monthYear = now.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });

    const { categoryId } = req.body;
    if (categoryId) {
      const category = await prisma.category.findFirst({ where: { id: categoryId, userId } });
      if (!category) return res.status(404).json({ error: 'Categoria non trovata' });
      if (category.type !== 'EXPENSE') return res.status(400).json({ error: 'La categoria deve essere di tipo Uscita' });
    }

    // Crea l'addebito reale sul conto bancario e marca pagate le pianificate.
    const [bankTransaction] = await prisma.$transaction([
      prisma.transaction.create({
        data: {
          amount: debtAmount,
          type: 'EXPENSE',
          description: `Addebito ${account.name} - ${monthYear}`,
          date: now,
          userId,
          accountId: linkedAccount.id,
          ...(categoryId && { categoryId }),
        },
      }),
      prisma.plannedTransaction.updateMany({
        where: { id: { in: duePlanned.map((p) => p.id) } },
        data: { isPaid: true },
      }),
    ]);

    analyticsCache.onTransactionMutated(userId);
    analyticsCache.onPlannedMutated(userId);

    res.status(201).json({
      transaction: { ...bankTransaction, amount: Number(bankTransaction.amount) },
      settledAmount: debtAmount,
    });
  } catch (error) {
    console.error('Settle account error:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
};

// Chiude il ciclo di billing della CC.
//   • Determina il ciclo che si conclude (quello che chiude oggi sul closingDay,
//     o il ciclo già concluso ancora aperto se chiamato dopo).
//   • Calcola il debito dalle transazioni nella finestra del ciclo.
//   • Crea/collega la PlannedTransaction (pagamento) dovuta al billingDay.
//   • Marca il ciclo CLOSED e apre il ciclo successivo.
// Non manipola più openingBalance: il saldo carta si ricalcola dal solo ciclo aperto.
// Idempotente: se il ciclo è già chiuso non duplica nulla.
export const closeBillingCycle = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const account = await prisma.account.findFirst({ where: { id, userId } });
    if (!account) return res.status(404).json({ error: 'Conto non trovato' });
    if (account.type !== 'CREDIT_CARD') return res.status(400).json({ error: 'Solo carte di credito' });
    if (!account.linkedAccountId) return res.status(400).json({ error: 'Nessun conto collegato' });

    const now = new Date();
    const closingDay = effectiveClosingDay(account);
    const current = currentCycleWindow(closingDay, now);

    // Il ciclo da chiudere è quello che si conclude oggi (closingDay) oppure, se
    // chiamato in un altro giorno, il ciclo precedente già concluso.
    const sameDay = (a: Date, b: Date) =>
      a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

    let closeWin = current;
    if (!sameDay(current.periodEnd, now)) {
      const before = new Date(current.periodStart);
      before.setDate(before.getDate() - 1);
      closeWin = currentCycleWindow(closingDay, before);
    }

    // Trova/crea il ciclo da chiudere
    const cycle = await prisma.billingCycle.upsert({
      where: { accountId_periodStart: { accountId: id, periodStart: closeWin.periodStart } },
      update: {},
      create: {
        userId,
        accountId: id,
        periodStart: closeWin.periodStart,
        periodEnd: closeWin.periodEnd,
        status: 'OPEN',
      },
    });

    // Apri sempre il ciclo successivo (idempotente)
    const dayAfter = new Date(closeWin.periodEnd);
    dayAfter.setDate(dayAfter.getDate() + 1);
    dayAfter.setHours(12, 0, 0, 0);
    await ensureOpenCycle(userId, account, dayAfter);

    if (cycle.status === 'CLOSED') {
      // Già chiuso: ricalcola comunque la pianificata per sicurezza
      const debt = await computeCycleDebt(id, closeWin.periodStart, closeWin.periodEnd);
      const synced = await syncCyclePlanned(cycle, account, debt);
      analyticsCache.onPlannedMutated(userId);
      return res.json({ cycled: false, alreadyClosed: true, debtAmount: synced });
    }

    const debt = await computeCycleDebt(id, closeWin.periodStart, closeWin.periodEnd);
    const billingDate = nextBillingDate(account.billingDay ?? 15, closeWin.periodEnd);

    // Marca chiuso, poi crea/collega la pianificata col debito calcolato
    const closed = await prisma.billingCycle.update({
      where: { id: cycle.id },
      data: { status: 'CLOSED', closedAt: now, billingDate },
    });
    const debtAmount = await syncCyclePlanned(closed, account, debt);

    analyticsCache.onTransactionMutated(userId);
    analyticsCache.onPlannedMutated(userId);

    res.status(201).json({
      cycled: debtAmount > 0,
      debtAmount,
      billingDate,
      cycleLabel: cycleLabel(closeWin.periodEnd),
    });
  } catch (error) {
    console.error('Close billing cycle error:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
};

export const setDefaultAccount = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const account = await prisma.account.findFirst({ where: { id, userId } });
    if (!account) {
      return res.status(404).json({ error: 'Conto non trovato' });
    }

    await prisma.$transaction([
      prisma.account.updateMany({ where: { userId }, data: { isDefault: false } }),
      prisma.account.update({ where: { id }, data: { isDefault: true } }),
    ]);

    res.json({ message: 'Conto principale aggiornato' });
  } catch (error) {
    console.error('Set default account error:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
};

// Storico dei cicli di fatturazione di una CC. Per il ciclo OPEN il debito è
// calcolato live dalle transazioni; per i cicli CLOSED si usa il valore congelato.
export const getBillingCycles = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const account = await prisma.account.findFirst({ where: { id, userId } });
    if (!account) return res.status(404).json({ error: 'Conto non trovato' });
    if (account.type !== 'CREDIT_CARD') return res.status(400).json({ error: 'Solo carte di credito' });

    // Garantisce l'esistenza del ciclo corrente prima di restituire lo storico
    await ensureOpenCycle(userId, account);

    const cycles = await prisma.billingCycle.findMany({
      where: { accountId: id },
      orderBy: { periodStart: 'desc' },
      include: {
        planned: { select: { id: true, amount: true, isPaid: true, plannedDate: true } },
      },
    });

    const result = await Promise.all(
      cycles.map(async (c) => {
        const debt = c.status === 'OPEN'
          ? await computeCycleDebt(id, c.periodStart, c.periodEnd)
          : Number(c.debtAmount);
        return {
          id: c.id,
          periodStart: c.periodStart,
          periodEnd: c.periodEnd,
          status: c.status,
          closedAt: c.closedAt,
          billingDate: c.billingDate,
          debtAmount: Math.round(debt * 100) / 100,
          planned: c.planned
            ? { ...c.planned, amount: Number(c.planned.amount) }
            : null,
        };
      }),
    );

    res.json(result);
  } catch (error) {
    console.error('Get billing cycles error:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
};
