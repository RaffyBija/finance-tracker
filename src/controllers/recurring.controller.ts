import { Response } from 'express';
import prisma from '../utils/prisma';
import { AuthRequest, CreateRecurringTransactionDTO } from '../types';

// Ottieni tutte le transazioni ricorrenti
export const getRecurringTransactions = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { active } = req.query;

    const where: any = { userId };
    
    if (active === 'true') {
      where.isActive = true;
    }

    const recurring = await prisma.recurringTransaction.findMany({
      where,
      include: {
        category: true,
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
      include: { category: true },
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
      endDate 
    }: CreateRecurringTransactionDTO = req.body;

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
      },
      include: { category: true },
    });

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
    const { amount, description, categoryId, frequency, dayOfMonth, startDate, endDate, isActive } = req.body;

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
      },
      include: { category: true },
    });

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

    res.json({ message: 'Transazione ricorrente eliminata con successo' });
  } catch (error) {
    console.error('Delete recurring transaction error:', error);
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

    res.json(updated);
  } catch (error) {
    console.error('Toggle recurring transaction error:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
};