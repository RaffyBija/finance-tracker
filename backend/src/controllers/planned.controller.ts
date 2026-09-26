import { Response } from 'express';
import prisma from '../utils/prisma';
import { AuthRequest, CreatePlannedTransactionDTO } from '../types';
import { analyticsCache } from '../utils/analyticsCache';
import { accountBelongsToUser } from '../utils/ownership';
import { reconcileCcChanges, debtContribution } from '../utils/billingCycle';

class AlreadyPaidError extends Error {}

// Ottieni pianificate scadute non pagate (data <= oggi)
export const getPlannedDue = async (req: AuthRequest, res: Response) => {
  try {
    const userId   = req.userId!;
    const cacheKey = analyticsCache.keys.plannedDue(userId);
    const cached   = analyticsCache.get<object[]>(cacheKey);
    if (cached) return res.json(cached);

    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const planned = await prisma.plannedTransaction.findMany({
      // planId: null → le rate dei piani a rate hanno il loro flusso (card + pagamento
      // del piano) e non devono comparire tra le pianificate "da registrare".
      where: { userId, isPaid: false, planId: null, plannedDate: { lte: endOfToday } },
      include: {
        category: true,
        account: { select: { id: true, name: true, color: true, type: true } },
      },
      orderBy: { plannedDate: 'asc' },
    });

    analyticsCache.set(cacheKey, planned);
    res.json(planned);
  } catch (error) {
    console.error('Get planned due error:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
};

// Ottieni tutte le transazioni pianificate
export const getPlannedTransactions = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { unpaidOnly, upcoming, suspendedOnly } = req.query;

    // Esclude le rate dei piani a rate (planId valorizzato): quelle vivono nel
    // loro piano, non nella lista delle pianificate singole (niente doppioni).
    const where: any = { userId, planId: null };

    // Sospesi (plannedDate null) e Pianificate (plannedDate valorizzata) sono
    // mutuamente esclusivi: senza suspendedOnly la lista "Pianificate" non deve
    // mai mostrare i Sospesi.
    where.plannedDate = suspendedOnly === 'true' ? null : { not: null };

    if (unpaidOnly === 'true') {
      where.isPaid = false;
    }

    if (upcoming === 'true') {
      // gte + not:null: resta coerente con la mutua esclusione Sospesi/Pianificate sopra.
      where.plannedDate = { gte: new Date(), not: null };
      where.isPaid = false;
    }

    const planned = await prisma.plannedTransaction.findMany({
      where,
      include: {
        category: true,
        account: { select: { id: true, name: true, color: true, type: true } },
      },
      // Secondo criterio per un ordine deterministico anche tra i Sospesi (plannedDate tutta null).
      orderBy: [
        { plannedDate: 'asc' },
        { createdAt: 'desc' },
      ],
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
      include: {
        category: true,
        account: { select: { id: true, name: true, color: true, type: true } },
      },
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
      notes,
      accountId,
    }: CreatePlannedTransactionDTO & { accountId?: string } = req.body;

    // plannedDate è opzionale: assente/vuota = "Sospeso" (importo noto, data ignota).
    if (!amount || amount <= 0 || !type || !description) {
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

    if (accountId) {
      const owned = await accountBelongsToUser(accountId, userId);
      if (!owned) {
        return res.status(404).json({ error: 'Conto non trovato' });
      }
    }

    const planned = await prisma.plannedTransaction.create({
      data: {
        amount,
        type,
        description,
        categoryId,
        plannedDate: plannedDate ? new Date(plannedDate) : null,
        notes,
        userId,
        ...(accountId && { accountId }),
      },
      include: {
        category: true,
        account: { select: { id: true, name: true, color: true, type: true } },
      },
    });

    analyticsCache.onPlannedMutated(userId);
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
    const { amount, description, categoryId, plannedDate, notes, isPaid, accountId } = req.body;

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

    if (accountId) {
      const owned = await accountBelongsToUser(accountId, userId);
      if (!owned) {
        return res.status(404).json({ error: 'Conto non trovato' });
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
        ...(accountId !== undefined && { accountId: accountId ?? null }),
      },
      include: {
        category: true,
        account: { select: { id: true, name: true, color: true, type: true } },
      },
    });

    analyticsCache.onPlannedMutated(userId);
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

    analyticsCache.onPlannedMutated(userId);
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
    const { date } = req.body || {};

    const planned = await prisma.plannedTransaction.findFirst({
      where: { id, userId },
    });

    if (!planned) {
      return res.status(404).json({ error: 'Transazione pianificata non trovata' });
    }

    // Un Sospeso (plannedDate null) non ha una data da cui derivare quella della
    // transazione reale: va richiesta esplicitamente dal client.
    if (planned.plannedDate === null && !date) {
      return res.status(400).json({ error: 'Indica la data della transazione' });
    }

    if (date !== undefined && isNaN(new Date(date).getTime())) {
      return res.status(400).json({ error: 'Data non valida' });
    }

    // Crea la transazione reale, propagando il conto della pianificata.
    // Per le pianificate normali il comportamento resta invariato: data = oggi.
    // Transazione reale + pianificata pagata in un'unica operazione atomica: mai
    // una transazione registrata con la pianificata ancora "da pagare" (o viceversa).
    // Il guard isPaid:false nell'update impedisce il doppio pagamento concorrente.
    const [transaction, updated] = await prisma.$transaction(async (tx) => {
      const created = await tx.transaction.create({
        data: {
          amount: planned.amount,
          type: planned.type,
          description: planned.description,
          categoryId: planned.categoryId,
          date: date ? new Date(date) : new Date(),
          userId,
          ...(planned.accountId && { accountId: planned.accountId }),
        },
      });
      const marked = await tx.plannedTransaction.updateMany({
        where: { id, isPaid: false },
        data: { isPaid: true },
      });
      if (marked.count === 0) throw new AlreadyPaidError();
      const paid = await tx.plannedTransaction.findUniqueOrThrow({
        where: { id },
        include: { category: true },
      });
      return [created, paid] as const;
    });

    // Pianificata su CC datata in un ciclo già chiuso → aggiorna l'addebito del ciclo.
    if (transaction.accountId) {
      const ccTouched = await reconcileCcChanges(userId, [{
        accountId: transaction.accountId,
        date: transaction.date,
        signed: debtContribution(transaction.type, Number(transaction.amount)),
      }]);
      if (ccTouched) analyticsCache.onPlannedMutated(userId);
    }

    // Nota: per le pianificate CC (ccAccountId valorizzato), il saldo della CC viene azzerato
    // al giorno di chiusura ciclo (closeBillingCycle), NON qui. Qui addebitiamo solo il conto bancario.

    analyticsCache.onPlannedPaid(userId);
    res.json({
      planned: updated,
      transaction,
      message: 'Transazione creata e spesa pianificata marcata come pagata'
    });
  } catch (error) {
    if (error instanceof AlreadyPaidError) {
      return res.status(409).json({ error: 'Transazione pianificata già pagata' });
    }
    console.error('Mark as paid error:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
};