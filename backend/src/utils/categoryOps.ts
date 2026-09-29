import prisma from './prisma';

// ── Operazioni sulle categorie (gerarchia, utilizzi, unione) ─────────────────

type Db = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

// Id della categoria e delle sue sotto-categorie (la gerarchia ha 2 livelli).
// Usato dagli aggregati "per macro" (budget su una macro, proposte).
export async function categoryWithChildren(categoryId: string, db: Db | typeof prisma = prisma): Promise<string[]> {
  const children = await db.category.findMany({ where: { parentId: categoryId }, select: { id: true } });
  return [categoryId, ...children.map((c) => c.id)];
}

export interface CategoryUsage {
  transactions: number;
  splitLines: number;
  recurring: number;
  planned: number;
  plans: number;
  budgets: number;
  children: number;
  salary: boolean;
}

export const usageTotal = (u: CategoryUsage) =>
  u.transactions + u.splitLines + u.recurring + u.planned + u.plans + u.budgets + u.children + (u.salary ? 1 : 0);

export async function categoryUsage(userId: string, categoryId: string): Promise<CategoryUsage> {
  const [transactions, splitLines, recurring, planned, plans, budgets, children, user] = await Promise.all([
    prisma.transaction.count({ where: { userId, categoryId } }),
    prisma.transactionItem.count({ where: { categoryId } }),
    prisma.recurringTransaction.count({ where: { userId, categoryId } }),
    prisma.plannedTransaction.count({ where: { userId, categoryId } }),
    prisma.installmentPlan.count({ where: { userId, categoryId } }),
    prisma.budget.count({ where: { userId, categoryId } }),
    prisma.category.count({ where: { userId, parentId: categoryId } }),
    prisma.user.findUnique({ where: { id: userId }, select: { salaryCategoryId: true } }),
  ]);
  return { transactions, splitLines, recurring, planned, plans, budgets, children, salary: user?.salaryCategoryId === categoryId };
}

export class CategoryRuleError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

// Valida il genitore per una categoria (nuova o spostata): stessa utenza e tipo,
// il genitore dev'essere una macro (niente terzo livello), non di sistema, e una
// categoria con sotto-categorie non può diventare a sua volta sotto-categoria.
export async function assertValidParent(params: {
  userId: string;
  parentId: string;
  type: 'INCOME' | 'EXPENSE';
  categoryId?: string;
}): Promise<void> {
  const { userId, parentId, type, categoryId } = params;
  if (categoryId && parentId === categoryId) throw new CategoryRuleError('Una categoria non può contenere sé stessa');
  const parent = await prisma.category.findFirst({ where: { id: parentId, userId } });
  if (!parent) throw new CategoryRuleError('Macro-categoria non trovata', 404);
  if (parent.type !== type) throw new CategoryRuleError('La macro-categoria deve essere dello stesso tipo');
  if (parent.parentId) throw new CategoryRuleError('Le sotto-categorie non possono contenere altre categorie');
  if (parent.isSystem) throw new CategoryRuleError('Non puoi aggiungere sotto-categorie a una categoria di sistema');
  if (categoryId) {
    const children = await prisma.category.count({ where: { parentId: categoryId } });
    if (children > 0) throw new CategoryRuleError('Questa categoria ha delle sotto-categorie: non può diventare a sua volta una sotto-categoria');
  }
}

// Unisce `sourceId` in `targetId`: tutto ciò che usa la categoria di origine passa a
// quella di destinazione (transazioni, righe di transazioni divise, ricorrenti,
// pianificate, piani a rate, budget, categoria stipendio), poi l'origine viene
// eliminata. Le sue sotto-categorie passano sotto la destinazione (o sotto la sua
// macro, se la destinazione è una sotto-categoria). Se la destinazione ha già un
// budget, quelli dell'origine vengono eliminati invece di duplicarlo.
export async function mergeCategory(userId: string, sourceId: string, targetId: string) {
  if (sourceId === targetId) throw new CategoryRuleError('Scegli una categoria diversa');
  const [source, target] = await Promise.all([
    prisma.category.findFirst({ where: { id: sourceId, userId } }),
    prisma.category.findFirst({ where: { id: targetId, userId } }),
  ]);
  if (!source || !target) throw new CategoryRuleError('Categoria non trovata', 404);
  if (source.isSystem) throw new CategoryRuleError('Questa categoria è gestita dal sistema', 403);
  if (source.type !== target.type) throw new CategoryRuleError('Le due categorie devono essere dello stesso tipo');
  if (target.parentId === sourceId) throw new CategoryRuleError('Non puoi unire una categoria in una sua sotto-categoria');

  const newParentForChildren = target.parentId ?? target.id;

  return prisma.$transaction(async (tx) => {
    await tx.transaction.updateMany({ where: { userId, categoryId: sourceId }, data: { categoryId: targetId } });
    await tx.transactionItem.updateMany({ where: { categoryId: sourceId }, data: { categoryId: targetId } });
    await tx.recurringTransaction.updateMany({ where: { userId, categoryId: sourceId }, data: { categoryId: targetId } });
    await tx.plannedTransaction.updateMany({ where: { userId, categoryId: sourceId }, data: { categoryId: targetId } });
    await tx.installmentPlan.updateMany({ where: { userId, categoryId: sourceId }, data: { categoryId: targetId } });

    const targetBudgets = await tx.budget.count({ where: { userId, categoryId: targetId } });
    const budgets = targetBudgets > 0
      ? await tx.budget.deleteMany({ where: { userId, categoryId: sourceId } })
      : await tx.budget.updateMany({ where: { userId, categoryId: sourceId }, data: { categoryId: targetId } });

    await tx.user.updateMany({ where: { id: userId, salaryCategoryId: sourceId }, data: { salaryCategoryId: targetId } });
    await tx.category.updateMany({ where: { userId, parentId: sourceId }, data: { parentId: newParentForChildren } });
    await tx.category.delete({ where: { id: sourceId } });
    return { budgetsRemoved: targetBudgets > 0 ? budgets.count : 0 };
  });
}
