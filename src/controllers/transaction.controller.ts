import { Response } from 'express';
import prisma from '../utils/prisma';
import { AuthRequest, CreateTransactionDTO } from '../types';

// Ottieni tutte le transazioni dell'utente
export const getTransactions = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { type, categoryId, startDate, endDate, limit, offset } = req.query;

    // Build filter
    const where: any = { userId };

    if (type && (type === 'INCOME' || type === 'EXPENSE')) {
      where.type = type;
    }

    if (categoryId) {
      where.categoryId = categoryId as string;
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

    const transactions = await prisma.transaction.findMany({
      where,
      include: {
        category: true,
      },
      orderBy: {
        date: 'desc',
      },
      take: limit ? parseInt(limit as string) : undefined,
      skip: offset ? parseInt(offset as string) : undefined,
    });

    res.json(transactions);
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

// Crea una nuova transazione
export const createTransaction = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { amount, type, description, date, categoryId }: CreateTransactionDTO = req.body;

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
      },
      include: {
        category: true,
      },
    });

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
    const { amount, type, description, date, categoryId } = req.body;

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
      },
      include: {
        category: true,
      },
    });

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

    res.json({ message: 'Transazione eliminata con successo' });
  } catch (error) {
    console.error('Delete transaction error:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
};