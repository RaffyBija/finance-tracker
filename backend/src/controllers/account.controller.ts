import { Response } from 'express';
import prisma from '../utils/prisma';
import { AuthRequest } from '../types';
import { analyticsCache } from '../utils/analyticsCache';

const MAX_FREE_ACCOUNTS = 3;

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

    // Calcola il saldo corrente per ogni account
    const accountsWithBalance = await Promise.all(
      accounts.map(async (account) => {
        const agg = await prisma.transaction.aggregate({
          where: { accountId: account.id },
          _sum: {
            amount: true,
          },
        });

        const incomeAgg = await prisma.transaction.aggregate({
          where: { accountId: account.id, type: 'INCOME' },
          _sum: { amount: true },
        });
        const expenseAgg = await prisma.transaction.aggregate({
          where: { accountId: account.id, type: 'EXPENSE' },
          _sum: { amount: true },
        });

        const income = Number(incomeAgg._sum.amount ?? 0);
        const expense = Number(expenseAgg._sum.amount ?? 0);
        // Per CC: openingBalance rappresenta il debito iniziale (positivo nel DB)
        // Il saldo è negativo (debito), quindi neghiamo l'opening balance
        const balance = account.type === 'CREDIT_CARD'
          ? -Number(account.openingBalance) + income - expense
          : Number(account.openingBalance) + income - expense;

        return {
          ...account,
          openingBalance: Number(account.openingBalance),
          creditLimit: account.creditLimit ? Number(account.creditLimit) : null,
          balance,
        };
      })
    );

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
    const { name, type, color, icon, openingBalance, creditLimit, billingDay, linkedAccountId } = req.body;

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

    const count = await prisma.account.count({ where: { userId } });
    if (count >= MAX_FREE_ACCOUNTS) {
      return res.status(403).json({ error: 'Limite account raggiunto', upgrade: true, limit: MAX_FREE_ACCOUNTS });
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
        creditLimit: type === 'CREDIT_CARD' && creditLimit ? creditLimit : null,
        billingDay: type === 'CREDIT_CARD' && billingDay ? Number(billingDay) : null,
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
    const { name, color, icon, openingBalance, creditLimit, billingDay, linkedAccountId } = req.body;

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
        ...(billingDay !== undefined && { billingDay: billingDay ? Number(billingDay) : null }),
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
