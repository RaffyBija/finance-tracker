import { Response } from 'express';
import { randomUUID } from 'node:crypto';
import prisma from '../utils/prisma';
import { AuthRequest, CreateTransactionDTO } from '../types';
import { analyticsCache } from '../utils/analyticsCache';
import { reconcileCcChanges, debtContribution } from '../utils/billingCycle';

// Ottieni tutte le transazioni dell'utente
export const getTransactions = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { type, categoryId, accountId, startDate, endDate, search, limit, offset } = req.query;

    // Build filter
    const where: any = { userId };

    if (type && (type === 'INCOME' || type === 'EXPENSE')) {
      where.type = type;
    }

    if (categoryId) {
      where.categoryId = categoryId as string;
    }

    if (accountId) {
      where.accountId = accountId as string;
    }

    if (startDate || endDate) {
      where.date = {};
      if (startDate) {
        where.date.gte = new Date(startDate as string);
      }
      if (endDate) {
        where.date.lte = new Date(endDate as string);
      }
    }

    if (search && typeof search === 'string' && search.trim()) {
      where.OR = [
        { description: { contains: search.trim(), mode: 'insensitive' } },
        { category: { name: { contains: search.trim(), mode: 'insensitive' } } },
      ];
    }

    const MAX_LIMIT = 200;
    const parsedLimit = limit ? Math.min(parseInt(limit as string), MAX_LIMIT) : MAX_LIMIT;

    const transactions = await prisma.transaction.findMany({
      where,
      include: {
        category: true,
        account: { select: { id: true, name: true, color: true, type: true } },
      },
      orderBy: {
        date: 'desc',
      },
      take: parsedLimit,
      skip: offset ? parseInt(offset as string) : 0,
    });

    // Arricchisci le gambe di trasferimento con il conto "peer" (l'altra gamba):
    // serve al frontend per mostrare "Conto A → Conto B" senza query extra.
    const transferIds = [
      ...new Set(transactions.map((t) => t.transferId).filter((id): id is string => !!id)),
    ];
    let withPeer: typeof transactions | (typeof transactions[number] & { transferPeer?: unknown })[] = transactions;
    if (transferIds.length > 0) {
      const legs = await prisma.transaction.findMany({
        where: { userId, transferId: { in: transferIds } },
        select: {
          id: true,
          transferId: true,
          type: true,
          account: { select: { id: true, name: true, color: true } },
        },
      });
      // Per ogni transferId, il peer di una gamba è la gamba con id diverso.
      const byTransfer = new Map<string, typeof legs>();
      for (const leg of legs) {
        const arr = byTransfer.get(leg.transferId!) ?? [];
        arr.push(leg);
        byTransfer.set(leg.transferId!, arr);
      }
      withPeer = transactions.map((t) => {
        if (!t.transferId) return t;
        const peer = byTransfer.get(t.transferId)?.find((l) => l.id !== t.id);
        return { ...t, transferPeer: peer?.account ?? null };
      });
    }

    res.json(withPeer);
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
};

// Ottieni una singola transazione
export const getTransaction = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const transaction = await prisma.transaction.findFirst({
      where: {
        id,
        userId,
      },
      include: {
        category: true,
        account: { select: { id: true, name: true, color: true, type: true } },
      },
    });

    if (!transaction) {
      return res.status(404).json({ error: 'Transazione non trovata' });
    }

    res.json(transaction);
  } catch (error) {
    console.error('Get transaction error:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
};

// Sceglie la categoria suggerita da una lista di transazioni storiche già
// ordinata per data desc: vince la categoria più frequente; a parità di
// frequenza vince la più recente (la prima incontrata nella lista ordinata).
// Funzione pura (testabile senza DB).
export const pickSuggestedCategory = (
  matches: { categoryId: string | null }[],
): string | null => {
  const counts = new Map<string, number>();
  let best: string | null = null;
  let bestCount = 0;
  for (const m of matches) {
    if (!m.categoryId) continue;
    const next = (counts.get(m.categoryId) ?? 0) + 1;
    counts.set(m.categoryId, next);
    // > (non >=): a parità di conteggio mantiene il primo (= più recente).
    if (next > bestCount) {
      bestCount = next;
      best = m.categoryId;
    }
  }
  return best;
};

// Suggerisce una categoria per un nuovo movimento in base allo storico
// dell'utente (stessa descrizione/payee, stesso tipo).
export const suggestCategory = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { description, type } = req.query;

    const normalized =
      typeof description === 'string' ? description.trim().toLowerCase() : '';

    if (normalized.length < 2 || (type !== 'INCOME' && type !== 'EXPENSE')) {
      return res.json({ categoryId: null });
    }

    const matches = await prisma.transaction.findMany({
      where: {
        userId,
        type,
        categoryId: { not: null },
        description: { contains: normalized, mode: 'insensitive' },
      },
      select: { categoryId: true },
      orderBy: { date: 'desc' },
      take: 25,
    });

    res.json({ categoryId: pickSuggestedCategory(matches) });
  } catch (error) {
    console.error('Suggest category error:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
};

// Crea una nuova transazione
export const createTransaction = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { amount, type, description, date, categoryId, accountId }: CreateTransactionDTO & { accountId?: string } = req.body;

    // Validazione
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Importo non valido' });
    }

    if (!type || (type !== 'INCOME' && type !== 'EXPENSE')) {
      return res.status(400).json({ error: 'Tipo non valido (INCOME o EXPENSE)' });
    }

    // Verifica che la categoria appartenga all'utente (se specificata)
    if (categoryId) {
      const category = await prisma.category.findFirst({
        where: {
          id: categoryId,
          userId,
        },
      });

      if (!category) {
        return res.status(404).json({ error: 'Categoria non trovata' });
      }

      // Verifica che il tipo della categoria corrisponda al tipo della transazione
      if (category.type !== type) {
        return res.status(400).json({ error: 'Il tipo della categoria non corrisponde al tipo della transazione' });
      }
    }

    const transaction = await prisma.transaction.create({
      data: {
        amount,
        type,
        description,
        date: date ? new Date(date) : new Date(),
        categoryId,
        userId,
        ...(accountId && { accountId }),
      },
      include: {
        category: true,
        account: { select: { id: true, name: true, color: true, type: true } },
      },
    });

    // Riconcilia eventuali cicli CC chiusi toccati da questa transazione retroattiva
    if (transaction.accountId) {
      await reconcileCcChanges(userId, [{
        accountId: transaction.accountId,
        date: transaction.date,
        signed: debtContribution(transaction.type, Number(transaction.amount)),
      }]);
      analyticsCache.onPlannedMutated(userId);
    }

    analyticsCache.onTransactionMutated(userId);
    res.status(201).json(transaction);
  } catch (error) {
    console.error('Create transaction error:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
};

// Aggiorna una transazione
export const updateTransaction = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { amount, type, description, date, categoryId, accountId } = req.body;

    // Verifica che la transazione esista e appartenga all'utente
    const existingTransaction = await prisma.transaction.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!existingTransaction) {
      return res.status(404).json({ error: 'Transazione non trovata' });
    }

    // Validazione amount se fornito
    if (amount !== undefined && amount <= 0) {
      return res.status(400).json({ error: 'Importo non valido' });
    }

    // Validazione type se fornito
    if (type && type !== 'INCOME' && type !== 'EXPENSE') {
      return res.status(400).json({ error: 'Tipo non valido (INCOME o EXPENSE)' });
    }

    // Verifica categoria se fornita
    if (categoryId) {
      const category = await prisma.category.findFirst({
        where: {
          id: categoryId,
          userId,
        },
      });

      if (!category) {
        return res.status(404).json({ error: 'Categoria non trovata' });
      }

      const finalType = type || existingTransaction.type;
      if (category.type !== finalType) {
        return res.status(400).json({ error: 'Il tipo della categoria non corrisponde al tipo della transazione' });
      }
    }

    const transaction = await prisma.transaction.update({
      where: { id },
      data: {
        ...(amount !== undefined && { amount }),
        ...(type && { type }),
        ...(description !== undefined && { description }),
        ...(date && { date: new Date(date) }),
        ...(categoryId !== undefined && { categoryId }),
        ...(accountId !== undefined && { accountId: accountId ?? null }),
      },
      include: {
        category: true,
        account: { select: { id: true, name: true, color: true, type: true } },
      },
    });

    // Riconcilia i cicli CC interessati: vecchio stato (rimosso) e nuovo (aggiunto).
    if (existingTransaction.accountId || transaction.accountId) {
      await reconcileCcChanges(userId, [
        {
          accountId: existingTransaction.accountId,
          date: existingTransaction.date,
          signed: -debtContribution(existingTransaction.type, Number(existingTransaction.amount)),
        },
        {
          accountId: transaction.accountId,
          date: transaction.date,
          signed: debtContribution(transaction.type, Number(transaction.amount)),
        },
      ]);
      analyticsCache.onPlannedMutated(userId);
    }

    analyticsCache.onTransactionMutated(userId);
    res.json(transaction);
  } catch (error) {
    console.error('Update transaction error:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
};

// Elimina una transazione
export const deleteTransaction = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    // Verifica che la transazione esista e appartenga all'utente
    const transaction = await prisma.transaction.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!transaction) {
      return res.status(404).json({ error: 'Transazione non trovata' });
    }

    await prisma.transaction.delete({
      where: { id },
    });

    // Riconcilia il ciclo CC eventualmente toccato dalla rimozione
    if (transaction.accountId) {
      await reconcileCcChanges(userId, [{
        accountId: transaction.accountId,
        date: transaction.date,
        signed: -debtContribution(transaction.type, Number(transaction.amount)),
      }]);
      analyticsCache.onPlannedMutated(userId);
    }

    analyticsCache.onTransactionMutated(userId);
    res.json({ message: 'Transazione eliminata con successo' });
  } catch (error) {
    console.error('Delete transaction error:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
};

// Crea un trasferimento tra due conti BANK: due transazioni collegate dallo
// stesso transferId (uscita sull'origine, entrata sulla destinazione). I
// trasferimenti non hanno categoria e sono esclusi dalle statistiche.
export const createTransfer = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { fromAccountId, toAccountId, amount, date, description } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Importo non valido' });
    }

    if (!fromAccountId || !toAccountId) {
      return res.status(400).json({ error: 'Conto di origine e destinazione obbligatori' });
    }

    if (fromAccountId === toAccountId) {
      return res.status(400).json({ error: 'Il conto di origine e destinazione devono essere diversi' });
    }

    // Entrambi i conti devono esistere, appartenere all'utente ed essere BANK.
    const accounts = await prisma.account.findMany({
      where: { id: { in: [fromAccountId, toAccountId] }, userId },
      select: { id: true, type: true },
    });

    if (accounts.length !== 2) {
      return res.status(404).json({ error: 'Conto non trovato' });
    }

    if (accounts.some((a) => a.type !== 'BANK')) {
      return res.status(400).json({ error: 'I trasferimenti sono consentiti solo tra conti bancari' });
    }

    const transferId = randomUUID();
    const txDate = date ? new Date(date) : new Date();

    await prisma.$transaction([
      prisma.transaction.create({
        data: {
          amount,
          type: 'EXPENSE',
          description,
          date: txDate,
          userId,
          accountId: fromAccountId,
          transferId,
        },
      }),
      prisma.transaction.create({
        data: {
          amount,
          type: 'INCOME',
          description,
          date: txDate,
          userId,
          accountId: toAccountId,
          transferId,
        },
      }),
    ]);

    analyticsCache.onTransactionMutated(userId);
    res.status(201).json({ message: 'Trasferimento creato con successo', transferId });
  } catch (error) {
    console.error('Create transfer error:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
};

// Aggiorna un trasferimento esistente: ritocca entrambe le gambe collegate dal
// transferId mantenendone gli id. La gamba EXPENSE va sull'origine, la INCOME
// sulla destinazione; importo, data e descrizione sono condivisi.
export const updateTransfer = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const transferId = Array.isArray(req.params.transferId)
      ? req.params.transferId[0]
      : req.params.transferId;
    const { fromAccountId, toAccountId, amount, date, description } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Importo non valido' });
    }

    if (!fromAccountId || !toAccountId) {
      return res.status(400).json({ error: 'Conto di origine e destinazione obbligatori' });
    }

    if (fromAccountId === toAccountId) {
      return res.status(400).json({ error: 'Il conto di origine e destinazione devono essere diversi' });
    }

    // Le due gambe devono esistere e appartenere all'utente.
    const legs = await prisma.transaction.findMany({
      where: { userId, transferId },
      select: { id: true, type: true },
    });

    if (legs.length !== 2) {
      return res.status(404).json({ error: 'Trasferimento non trovato' });
    }

    // Entrambi i conti devono esistere, appartenere all'utente ed essere BANK.
    const accounts = await prisma.account.findMany({
      where: { id: { in: [fromAccountId, toAccountId] }, userId },
      select: { id: true, type: true },
    });

    if (accounts.length !== 2) {
      return res.status(404).json({ error: 'Conto non trovato' });
    }

    if (accounts.some((a) => a.type !== 'BANK')) {
      return res.status(400).json({ error: 'I trasferimenti sono consentiti solo tra conti bancari' });
    }

    const expenseLeg = legs.find((l) => l.type === 'EXPENSE');
    const incomeLeg = legs.find((l) => l.type === 'INCOME');

    if (!expenseLeg || !incomeLeg) {
      return res.status(409).json({ error: 'Trasferimento in uno stato non valido' });
    }

    const txDate = date ? new Date(date) : new Date();

    await prisma.$transaction([
      prisma.transaction.update({
        where: { id: expenseLeg.id },
        data: { accountId: fromAccountId, amount, date: txDate, description },
      }),
      prisma.transaction.update({
        where: { id: incomeLeg.id },
        data: { accountId: toAccountId, amount, date: txDate, description },
      }),
    ]);

    analyticsCache.onTransactionMutated(userId);
    res.json({ message: 'Trasferimento aggiornato con successo', transferId });
  } catch (error) {
    console.error('Update transfer error:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
};

// Elimina un trasferimento: rimuove entrambe le gambe collegate dal transferId.
export const deleteTransfer = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const transferId = Array.isArray(req.params.transferId)
      ? req.params.transferId[0]
      : req.params.transferId;

    const result = await prisma.transaction.deleteMany({
      where: { userId, transferId },
    });

    if (result.count === 0) {
      return res.status(404).json({ error: 'Trasferimento non trovato' });
    }

    analyticsCache.onTransactionMutated(userId);
    res.json({ message: 'Trasferimento eliminato con successo' });
  } catch (error) {
    console.error('Delete transfer error:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
};