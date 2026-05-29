import { Response } from 'express';
import prisma from '../utils/prisma';
import { AuthRequest } from '../types';
import { analyticsCache } from '../utils/analyticsCache';

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

    const accountsWithBalance = accounts.map((account) => {
      const { income = 0, expense = 0 } = balanceMap[account.id] ?? {};
      // Per CC: openingBalance è il debito iniziale (positivo nel DB), il saldo è negativo
      const balance = account.type === 'CREDIT_CARD'
        ? -Number(account.openingBalance) + income - expense
        : Number(account.openingBalance) + income - expense;
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
        linkedCC: { select: { id: true, name: true } },
      },
    });

    if (!account) {
      return res.status(404).json({ error: 'Conto non trovato' });
    }

    res.json({
      ...account,
      openingBalance: Number(account.openingBalance),
      creditLimit: account.creditLimit ? Number(account.creditLimit) : null,
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
    const { name, color, icon, openingBalance, creditLimit, billingDay, closingDay, linkedAccountId } = req.body;

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
        ...(openingBalance !== undefined && { openingBalance }),
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

    const incomeAgg = await prisma.transaction.aggregate({ where: { accountId: account.id, type: 'INCOME' }, _sum: { amount: true } });
    const expenseAgg = await prisma.transaction.aggregate({ where: { accountId: account.id, type: 'EXPENSE' }, _sum: { amount: true } });

    const income = Number(incomeAgg._sum.amount ?? 0);
    const expense = Number(expenseAgg._sum.amount ?? 0);
    const balance = -Number(account.openingBalance) + income - expense;

    if (balance >= 0) return res.status(400).json({ error: 'Nessun debito da saldare', balance });

    const debtAmount = Math.abs(balance);
    const now = new Date();
    const monthYear = now.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });

    const { categoryId } = req.body;

    if (categoryId) {
      const category = await prisma.category.findFirst({ where: { id: categoryId, userId } });
      if (!category) return res.status(404).json({ error: 'Categoria non trovata' });
      if (category.type !== 'EXPENSE') return res.status(400).json({ error: 'La categoria deve essere di tipo Uscita' });
    }

    // newOpeningBalance che azzera il saldo CC senza creare transazioni sulla CC:
    // balance = -newOB + income - expense = 0  →  newOB = income - expense
    const newCCOpeningBalance = income - expense;

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
      prisma.account.update({
        where: { id: account.id },
        data: { openingBalance: newCCOpeningBalance },
      }),
    ]);

    // Marca come pagata la pianificata di billing CC per questo mese (se esiste)
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    await prisma.plannedTransaction.updateMany({
      where: {
        userId,
        ccAccountId: account.id,
        isPaid: false,
        plannedDate: { gte: startOfMonth, lte: endOfMonth },
      },
      data: { isPaid: true },
    });

    analyticsCache.onTransactionMutated(userId);

    res.status(201).json({
      transaction: { ...bankTransaction, amount: Number(bankTransaction.amount) },
      settledAmount: debtAmount,
    });
  } catch (error) {
    console.error('Settle account error:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
};

// Chiude il ciclo di billing della CC:
//   1. Azzera il saldo CC (il plafond torna disponibile per il nuovo ciclo)
//   2. Crea la pianificata per il pagamento al billingDay del mese corrente/successivo
// Idempotente: se la pianificata esiste già per il mese corrente non crea duplicati.
export const closeBillingCycle = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const account = await prisma.account.findFirst({ where: { id, userId } });
    if (!account) return res.status(404).json({ error: 'Conto non trovato' });
    if (account.type !== 'CREDIT_CARD') return res.status(400).json({ error: 'Solo carte di credito' });
    if (!account.linkedAccountId) return res.status(400).json({ error: 'Nessun conto collegato' });

    // Calcola il debito corrente del ciclo che si sta chiudendo
    const incomeAgg  = await prisma.transaction.aggregate({ where: { accountId: id, type: 'INCOME'  }, _sum: { amount: true } });
    const expenseAgg = await prisma.transaction.aggregate({ where: { accountId: id, type: 'EXPENSE' }, _sum: { amount: true } });
    const income  = Number(incomeAgg._sum.amount  ?? 0);
    const expense = Number(expenseAgg._sum.amount ?? 0);
    const balance = -Number(account.openingBalance) + income - expense;

    if (balance >= 0) {
      return res.json({ cycled: false, message: 'Nessun debito da chiudere' });
    }

    const debtAmount = Math.abs(balance);
    const now = new Date();

    // Idempotente: controlla se la pianificata di questo mese esiste già
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    const existing = await prisma.plannedTransaction.findFirst({
      where: { userId, ccAccountId: id, isPaid: false, plannedDate: { gte: startOfMonth, lte: endOfMonth } },
    });

    // Calcola la data di scadenza: billingDay del mese corrente (se non ancora passato) o del prossimo
    const billingDay = account.billingDay ?? 15;
    const billingDate = new Date(now.getFullYear(), now.getMonth(), billingDay);
    if (billingDate <= now) billingDate.setMonth(billingDate.getMonth() + 1);

    // Mese di riferimento del ciclo che si chiude (es. "maggio 2026")
    const cycleMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      .toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });

    let planned = existing;
    if (!existing) {
      planned = await prisma.plannedTransaction.create({
        data: {
          userId,
          type: 'EXPENSE',
          amount: debtAmount,
          description: `Addebito ${account.name} - ${cycleMonth}`,
          plannedDate: billingDate,
          accountId: account.linkedAccountId,
          ccAccountId: id,
        },
      });
    }

    // Azzera il saldo CC: il nuovo ciclo inizia da 0 (plafond completamente libero)
    // Il debito è ora "frozen" nella pianificata — non nelle transazioni della CC
    const newOpeningBalance = income - expense; // → saldo = 0
    await prisma.account.update({ where: { id }, data: { openingBalance: newOpeningBalance } });

    analyticsCache.onTransactionMutated(userId);
    analyticsCache.onPlannedMutated(userId);

    res.status(201).json({
      cycled: true,
      debtAmount,
      billingDate,
      created: !existing,
      planned: planned ? { ...planned, amount: Number(planned.amount) } : null,
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
