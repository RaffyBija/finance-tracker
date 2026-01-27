import { Response } from 'express';
import prisma from '../utils/prisma';
import { AuthRequest, CreatePlannedTransactionDTO } from '../types';

// Ottieni tutte le transazioni pianificate
export const getPlannedTransactions = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { unpaidOnly, upcoming } = req.query;

    const where: any = { userId };
    
    if (unpaidOnly === 'true') {
      where.isPaid = false;
    }

    if (upcoming === 'true') {
      where.plannedDate = { gte: new Date() };
      where.isPaid = false;
    }

    const planned = await prisma.plannedTransaction.findMany({
      where,
      include: {
        category: true,
      },
      orderBy: {
        plannedDate: 'asc',
      },
    });

    res.json(planned);
  } catch (error) {
    console.error('Get planned transactions error:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
};

// Ottieni una transazione pianificata
export const getPlannedTransaction = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const planned = await prisma.plannedTransaction.findFirst({
      where: { id, userId },
      include: { category: true },
    });

    if (!planned) {
      return res.status(404).json({ error: 'Transazione pianificata non trovata' });
    }

    res.json(planned);
  } catch (error) {
    console.error('Get planned transaction error:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
};

// Crea una transazione pianificata
export const createPlannedTransaction = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { 
      amount, 
      type, 
      description, 
      categoryId, 
      plannedDate,
      notes
    }: CreatePlannedTransactionDTO = req.body;

    if (!amount || amount <= 0 || !type || !description || !plannedDate) {
      return res.status(400).json({ error: 'Dati non validi' });
    }

    if (type !== 'INCOME' && type !== 'EXPENSE') {
      return res.status(400).json({ error: 'Tipo non valido' });
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

    const planned = await prisma.plannedTransaction.create({
      data: {
        amount,
        type,
        description,
        categoryId,
        plannedDate: new Date(plannedDate),
        notes,
        userId,
      },
      include: { category: true },
    });

    res.status(201).json(planned);
  } catch (error) {
    console.error('Create planned transaction error:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
};

// Aggiorna una transazione pianificata
export const updatePlannedTransaction = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { amount, description, categoryId, plannedDate, notes, isPaid } = req.body;

    const existing = await prisma.plannedTransaction.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Transazione pianificata non trovata' });
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

    const planned = await prisma.plannedTransaction.update({
      where: { id },
      data: {
        ...(amount !== undefined && { amount }),
        ...(description && { description }),
        ...(categoryId !== undefined && { categoryId }),
        ...(plannedDate && { plannedDate: new Date(plannedDate) }),
        ...(notes !== undefined && { notes }),
        ...(isPaid !== undefined && { isPaid }),
      },
      include: { category: true },
    });

    res.json(planned);
  } catch (error) {
    console.error('Update planned transaction error:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
};

// Elimina una transazione pianificata
export const deletePlannedTransaction = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const planned = await prisma.plannedTransaction.findFirst({
      where: { id, userId },
    });

    if (!planned) {
      return res.status(404).json({ error: 'Transazione pianificata non trovata' });
    }

    await prisma.plannedTransaction.delete({ where: { id } });

    res.json({ message: 'Transazione pianificata eliminata con successo' });
  } catch (error) {
    console.error('Delete planned transaction error:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
};

// Marca come pagato e crea transazione reale
export const markAsPaid = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const planned = await prisma.plannedTransaction.findFirst({
      where: { id, userId },
    });

    if (!planned) {
      return res.status(404).json({ error: 'Transazione pianificata non trovata' });
    }

    // Crea la transazione reale
    const transaction = await prisma.transaction.create({
      data: {
        amount: planned.amount,
        type: planned.type,
        description: planned.description,
        categoryId: planned.categoryId,
        date: new Date(),
        userId,
      },
    });

    // Marca come pagato
    const updated = await prisma.plannedTransaction.update({
      where: { id },
      data: { isPaid: true },
      include: { category: true },
    });

    res.json({ 
      planned: updated, 
      transaction,
      message: 'Transazione creata e spesa pianificata marcata come pagata' 
    });
  } catch (error) {
    console.error('Mark as paid error:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
};