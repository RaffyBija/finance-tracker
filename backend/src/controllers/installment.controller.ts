import { Response } from 'express';
import prisma from '../utils/prisma';
import { AuthRequest, CreateInstallmentPlanDTO, PayInstallmentsDTO } from '../types';
import { analyticsCache } from '../utils/analyticsCache';

// La direzione del piano determina il tipo delle rate:
// DEBT → EXPENSE (uscite future), CREDIT → INCOME (entrate attese).
const typeForDirection = (direction: 'DEBT' | 'CREDIT'): 'INCOME' | 'EXPENSE' =>
  direction === 'CREDIT' ? 'INCOME' : 'EXPENSE';

// Include standard: piano + rate (ordinate per data) + relazioni leggere.
const planInclude = {
  installments: {
    orderBy: { plannedDate: 'asc' as const },
    include: {
      category: true,
      account: { select: { id: true, name: true, color: true, type: true } },
    },
  },
  category: true,
  account: { select: { id: true, name: true, color: true, type: true } },
  ccAccount: { select: { id: true, name: true, color: true, type: true } },
};

// Progresso di un piano calcolato dalle sue rate: "X su Y", incassato/pagato,
// residuo e prossima scadenza (prima rata non ancora saldata).
function computePlanProgress(
  installments: Array<{ amount: unknown; isPaid: boolean; plannedDate: Date }>,
) {
  let paidCount = 0;
  let paidAmount = 0;
  let remainingAmount = 0;
  let nextDueDate: Date | null = null;

  for (const r of installments) {
    const amt = Number(r.amount);
    if (r.isPaid) {
      paidCount++;
      paidAmount += amt;
    } else {
      remainingAmount += amt;
      if (!nextDueDate || r.plannedDate < nextDueDate) nextDueDate = r.plannedDate;
    }
  }

  return {
    totalCount: installments.length,
    paidCount,
    paidAmount: Math.round(paidAmount * 100) / 100,
    remainingAmount: Math.round(remainingAmount * 100) / 100,
    nextDueDate,
  };
}

type PlanWithRate = { installments: Array<{ amount: unknown; isPaid: boolean; plannedDate: Date }> };
const withProgress = <T extends PlanWithRate>(plan: T) => ({
  ...plan,
  progress: computePlanProgress(plan.installments),
});

// Ottieni tutti i piani a rate dell'utente (con progresso)
export const getInstallmentPlans = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const plans = await prisma.installmentPlan.findMany({
      where: { userId },
      include: planInclude,
      orderBy: { createdAt: 'desc' },
    });
    res.json(plans.map(withProgress));
  } catch (error) {
    console.error('Get installment plans error:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
};

// Rate in scadenza (non pagate, data ≤ oggi) di tutti i piani dell'utente.
// Escluse da GET /planned/due (planId: null): qui hanno il loro flusso dedicato,
// che alimenta il badge navbar/tab dello scadenzario via PendingContext.
export const getInstallmentsDue = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const cacheKey = analyticsCache.keys.installmentsDue(userId);
    const cached = analyticsCache.get<object[]>(cacheKey);
    if (cached) return res.json(cached);

    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const rate = await prisma.plannedTransaction.findMany({
      where: { userId, isPaid: false, planId: { not: null }, plannedDate: { lte: endOfToday } },
      include: {
        category: true,
        plan: { select: { id: true, title: true, direction: true, accountId: true } },
      },
      orderBy: { plannedDate: 'asc' },
    });

    analyticsCache.set(cacheKey, rate);
    res.json(rate);
  } catch (error) {
    console.error('Get installments due error:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
};

// Ottieni un singolo piano a rate
export const getInstallmentPlan = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const plan = await prisma.installmentPlan.findFirst({
      where: { id, userId },
      include: planInclude,
    });

    if (!plan) {
      return res.status(404).json({ error: 'Piano a rate non trovato' });
    }

    res.json(withProgress(plan));
  } catch (error) {
    console.error('Get installment plan error:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
};

// Verifica che la categoria appartenga all'utente e sia del tipo giusto.
async function assertCategory(categoryId: string, userId: string, type: 'INCOME' | 'EXPENSE') {
  const category = await prisma.category.findFirst({ where: { id: categoryId, userId } });
  if (!category) return { ok: false, status: 404, error: 'Categoria non trovata' } as const;
  if (category.type !== type) return { ok: false, status: 400, error: 'Il tipo della categoria non corrisponde' } as const;
  return { ok: true } as const;
}

// Etichetta di una rata: usa la controparte se presente (crediti), altrimenti "rata i/N".
const rataLabel = (title: string, counterparty: string | null | undefined, index: number, total: number) =>
  counterparty?.trim() ? `${title} — ${counterparty.trim()}` : `${title} — rata ${index}/${total}`;

// Crea un piano a rate + le sue N rate (PlannedTransaction) in una transazione.
export const createInstallmentPlan = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const {
      direction,
      title,
      notes,
      categoryId,
      accountId,
      ccAccountId,
      installments,
    }: CreateInstallmentPlanDTO = req.body;

    if (direction !== 'DEBT' && direction !== 'CREDIT') {
      return res.status(400).json({ error: 'Direzione non valida' });
    }
    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Il titolo è obbligatorio' });
    }
    if (!Array.isArray(installments) || installments.length === 0) {
      return res.status(400).json({ error: 'Aggiungi almeno una rata' });
    }
    for (const r of installments) {
      if (!r || !r.amount || Number(r.amount) <= 0 || !r.plannedDate) {
        return res.status(400).json({ error: 'Ogni rata richiede un importo valido e una data' });
      }
    }

    const type = typeForDirection(direction);

    if (categoryId) {
      const check = await assertCategory(categoryId, userId, type);
      if (!check.ok) return res.status(check.status).json({ error: check.error });
    }

    const cleanTitle = title.trim();
    const total = installments.length;
    const totalAmount = installments.reduce((s, r) => s + Number(r.amount), 0);

    const createdId = await prisma.$transaction(async (tx) => {
      const plan = await tx.installmentPlan.create({
        data: {
          userId,
          direction,
          title: cleanTitle,
          totalAmount,
          notes: notes ?? null,
          categoryId: categoryId ?? null,
          accountId: accountId ?? null,
          ccAccountId: ccAccountId ?? null,
        },
      });

      await tx.plannedTransaction.createMany({
        data: installments.map((r, i) => ({
          amount: Number(r.amount),
          type,
          description: rataLabel(cleanTitle, r.counterparty, i + 1, total),
          categoryId: categoryId ?? null,
          plannedDate: new Date(r.plannedDate),
          notes: r.notes ?? null,
          userId,
          accountId: accountId ?? null,
          ccAccountId: ccAccountId ?? null,
          planId: plan.id,
          counterparty: r.counterparty ?? null,
        })),
      });

      return plan.id;
    });

    const full = await prisma.installmentPlan.findUnique({
      where: { id: createdId },
      include: planInclude,
    });

    analyticsCache.onPlannedMutated(userId);
    res.status(201).json(withProgress(full!));
  } catch (error) {
    console.error('Create installment plan error:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
};

// Aggiorna un piano: meta + rate NON pagate. Le rate già pagate sono immutabili
// (hanno generato una transazione reale). Ricalcola totale e stato.
export const updateInstallmentPlan = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { title, notes, categoryId, accountId, ccAccountId, installments } = req.body;

    const existing = await prisma.installmentPlan.findFirst({
      where: { id, userId },
      include: { installments: true },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Piano a rate non trovato' });
    }

    const type = typeForDirection(existing.direction);

    if (categoryId) {
      const check = await assertCategory(categoryId, userId, type);
      if (!check.ok) return res.status(check.status).json({ error: check.error });
    }

    // Se vengono passate nuove rate, validale prima di toccare il DB.
    if (installments !== undefined) {
      if (!Array.isArray(installments) || installments.length === 0) {
        return res.status(400).json({ error: 'Aggiungi almeno una rata' });
      }
      for (const r of installments) {
        if (!r || !r.amount || Number(r.amount) <= 0 || !r.plannedDate) {
          return res.status(400).json({ error: 'Ogni rata richiede un importo valido e una data' });
        }
      }
    }

    const cleanTitle = (title ?? existing.title).trim();

    await prisma.$transaction(async (tx) => {
      // 1. meta del piano
      await tx.installmentPlan.update({
        where: { id },
        data: {
          ...(title !== undefined && { title: cleanTitle }),
          ...(notes !== undefined && { notes: notes ?? null }),
          ...(categoryId !== undefined && { categoryId: categoryId || null }),
          ...(accountId !== undefined && { accountId: accountId || null }),
          ...(ccAccountId !== undefined && { ccAccountId: ccAccountId || null }),
        },
      });

      if (Array.isArray(installments)) {
        // 2a. sostituisci l'insieme delle rate NON pagate
        const paidRate = existing.installments.filter((r) => r.isPaid);
        await tx.plannedTransaction.deleteMany({ where: { planId: id, isPaid: false } });
        const total = paidRate.length + installments.length;
        await tx.plannedTransaction.createMany({
          data: installments.map((r: any, i: number) => ({
            amount: Number(r.amount),
            type,
            description: rataLabel(cleanTitle, r.counterparty, paidRate.length + i + 1, total),
            categoryId: categoryId !== undefined ? (categoryId || null) : existing.categoryId,
            plannedDate: new Date(r.plannedDate),
            notes: r.notes ?? null,
            userId,
            accountId: accountId !== undefined ? (accountId || null) : existing.accountId,
            ccAccountId: ccAccountId !== undefined ? (ccAccountId || null) : existing.ccAccountId,
            planId: id,
            counterparty: r.counterparty ?? null,
          })),
        });
      } else {
        // 2b. nessuna nuova rata: propaga i meta cambiati alle sole rate non pagate
        const propagate: Record<string, unknown> = {};
        if (categoryId !== undefined) propagate.categoryId = categoryId || null;
        if (accountId !== undefined) propagate.accountId = accountId || null;
        if (ccAccountId !== undefined) propagate.ccAccountId = ccAccountId || null;
        if (Object.keys(propagate).length > 0) {
          await tx.plannedTransaction.updateMany({ where: { planId: id, isPaid: false }, data: propagate });
        }
      }

      // 3. ricalcola totale e stato dal set completo delle rate
      const allRate = await tx.plannedTransaction.findMany({ where: { planId: id } });
      const totalAmount = allRate.reduce((s, r) => s + Number(r.amount), 0);
      const allPaid = allRate.length > 0 && allRate.every((r) => r.isPaid);
      await tx.installmentPlan.update({
        where: { id },
        data: { totalAmount, status: allPaid ? 'COMPLETED' : 'ACTIVE' },
      });
    });

    const full = await prisma.installmentPlan.findUnique({ where: { id }, include: planInclude });
    analyticsCache.onPlannedMutated(userId);
    res.json(withProgress(full!));
  } catch (error) {
    console.error('Update installment plan error:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
};

// Elimina un piano: rimuove le rate NON pagate; le rate pagate vengono scollegate
// (planId → null via onDelete SetNull) per non perdere lo storico.
export const deleteInstallmentPlan = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const existing = await prisma.installmentPlan.findFirst({ where: { id, userId } });
    if (!existing) {
      return res.status(404).json({ error: 'Piano a rate non trovato' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.plannedTransaction.deleteMany({ where: { planId: id, isPaid: false } });
      await tx.installmentPlan.delete({ where: { id } });
    });

    analyticsCache.onPlannedMutated(userId);
    res.json({ message: 'Piano a rate eliminato con successo' });
  } catch (error) {
    console.error('Delete installment plan error:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
};

// Paga una o più rate → crea UNA SOLA transazione reale con l'importo sommato,
// marca le rate come pagate e completa il piano se non restano rate aperte.
export const payInstallments = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { plannedIds, accountId, date }: PayInstallmentsDTO = req.body;

    if (!Array.isArray(plannedIds) || plannedIds.length === 0) {
      return res.status(400).json({ error: 'Seleziona almeno una rata' });
    }

    const rate = await prisma.plannedTransaction.findMany({
      where: { id: { in: plannedIds }, userId, isPaid: false },
    });

    if (rate.length !== plannedIds.length) {
      return res.status(400).json({ error: 'Alcune rate non sono valide o già pagate' });
    }

    const planId = rate[0].planId;
    if (!planId || rate.some((r) => r.planId !== planId)) {
      return res.status(400).json({ error: 'Le rate devono appartenere allo stesso piano' });
    }
    if (rate.some((r) => r.type !== rate[0].type)) {
      return res.status(400).json({ error: 'Le rate del piano hanno tipi incoerenti' });
    }

    const plan = await prisma.installmentPlan.findFirst({ where: { id: planId, userId } });
    if (!plan) {
      return res.status(404).json({ error: 'Piano a rate non trovato' });
    }

    const type = rate[0].type;
    const totalAmount = rate.reduce((s, r) => s + Number(r.amount), 0);
    // Conto dell'addebito/accredito: quello passato, altrimenti il conto del piano,
    // altrimenti quello della prima rata.
    const targetAccountId = accountId ?? plan.accountId ?? rate[0].accountId ?? undefined;
    const txDate = date ? new Date(date) : new Date();
    const rateWord = rate.length === 1 ? '1 rata' : `${rate.length} rate`;

    const transaction = await prisma.$transaction(async (tx) => {
      const created = await tx.transaction.create({
        data: {
          amount: totalAmount,
          type,
          description: `${plan.title} — ${rateWord}`,
          categoryId: plan.categoryId ?? rate[0].categoryId ?? null,
          date: txDate,
          userId,
          ...(targetAccountId && { accountId: targetAccountId }),
        },
      });

      await tx.plannedTransaction.updateMany({
        where: { id: { in: plannedIds } },
        data: { isPaid: true },
      });

      const remaining = await tx.plannedTransaction.count({ where: { planId, isPaid: false } });
      if (remaining === 0) {
        await tx.installmentPlan.update({ where: { id: planId }, data: { status: 'COMPLETED' } });
      }

      return created;
    });

    analyticsCache.onPlannedPaid(userId);
    res.json({
      transaction,
      count: rate.length,
      message:
        rate.length === 1
          ? 'Rata pagata e transazione registrata'
          : `${rate.length} rate pagate in un'unica transazione`,
    });
  } catch (error) {
    console.error('Pay installments error:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
};
