import { Response } from 'express';
import { CategoryNature, Prisma } from '@prisma/client';
import prisma from '../utils/prisma';
import { AuthRequest, CreateCategoryDTO } from '../types';
import { analyticsCache } from '../utils/analyticsCache';
import {
  assertValidParent, categoryUsage, mergeCategory, usageTotal, CategoryRuleError,
} from '../utils/categoryOps';
import {
  DEFAULT_CATEGORIES, SALARY_TEMPLATE_KEY, seedDefaultCategories, suggestPlacement, templateByKey,
  normalizeCategoryOrder,
} from '../utils/defaultCategories';

// Categorie a 2 livelli (macro → sotto-categorie), ordinabili, archiviabili, con
// natura (essenziale/discrezionale) sulle macro. Eliminare una categoria in uso
// richiede una destinazione: tutto viene spostato lì (mai budget o transazioni
// orfani). Vedi utils/categoryOps.ts e utils/defaultCategories.ts.

const NATURES: CategoryNature[] = ['ESSENTIAL', 'DISCRETIONARY'];

const handleRuleError = (res: Response, error: unknown, fallback: string) => {
  if (error instanceof CategoryRuleError) return res.status(error.status).json({ error: error.message });
  console.error(fallback, error);
  return res.status(500).json({ error: 'Errore del server' });
};

const categoryInclude = {
  _count: {
    select: {
      transactions: true,
      transactionItems: true,
      recurringTransactions: true,
      plannedTransactions: true,
      budgets: true,
      children: true,
    },
  },
} as const;

// Ottieni le categorie dell'utente (archiviate escluse, salvo ?includeArchived=true)
export const getCategories = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { type, includeArchived } = req.query;

    const where: Prisma.CategoryWhereInput = { userId };
    if (type && (type === 'INCOME' || type === 'EXPENSE')) where.type = type;
    if (includeArchived !== 'true') where.archivedAt = null;

    const categories = await prisma.category.findMany({
      where,
      include: categoryInclude,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });

    res.json(categories);
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
};

// Ottieni una singola categoria
export const getCategory = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const category = await prisma.category.findFirst({ where: { id, userId }, include: categoryInclude });
    if (!category) return res.status(404).json({ error: 'Categoria non trovata' });

    res.json(category);
  } catch (error) {
    console.error('Get category error:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
};

// Crea una categoria (macro o sotto-categoria)
export const createCategory = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { name, type, color, icon, parentId, nature }: CreateCategoryDTO = req.body;

    if (!name || !name.trim()) return res.status(400).json({ error: 'Nome categoria obbligatorio' });
    if (!type || (type !== 'INCOME' && type !== 'EXPENSE')) {
      return res.status(400).json({ error: 'Tipo non valido (INCOME o EXPENSE)' });
    }
    if (nature !== undefined && nature !== null && !NATURES.includes(nature)) {
      return res.status(400).json({ error: 'Natura non valida' });
    }

    const existingCategory = await prisma.category.findFirst({ where: { userId, name: name.trim(), type } });
    if (existingCategory) {
      return res.status(409).json({
        error: existingCategory.archivedAt
          ? 'Esiste una categoria archiviata con questo nome: ripristinala o scegli un altro nome'
          : 'Esiste già una categoria con questo nome e tipo',
      });
    }

    if (parentId) await assertValidParent({ userId, parentId, type });

    // In coda ai fratelli (stessa macro o stesso livello).
    const last = await prisma.category.aggregate({
      where: { userId, type, parentId: parentId || null },
      _max: { sortOrder: true },
    });

    const category = await prisma.category.create({
      data: {
        name: name.trim(),
        type,
        color,
        icon,
        userId,
        parentId: parentId || null,
        // La natura vive sulle macro: una sotto-categoria eredita quella della macro.
        nature: parentId ? null : nature ?? null,
        sortOrder: (last._max.sortOrder ?? -1) + 1,
      },
      include: categoryInclude,
    });

    analyticsCache.onCategoryMutated(userId);
    res.status(201).json(category);
  } catch (error) {
    handleRuleError(res, error, 'Create category error:');
  }
};

// Aggiorna una categoria: nome, colore, icona, macro di appartenenza, natura
export const updateCategory = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { name, color, icon, parentId, nature } = req.body || {};

    const existingCategory = await prisma.category.findFirst({ where: { id, userId } });
    if (!existingCategory) return res.status(404).json({ error: 'Categoria non trovata' });

    // La categoria di sistema (es. "Pagamento Carta") non è modificabile dall'utente.
    if (existingCategory.isSystem) {
      return res.status(403).json({ error: 'Questa categoria è gestita dal sistema e non può essere modificata' });
    }
    if (nature !== undefined && nature !== null && !NATURES.includes(nature)) {
      return res.status(400).json({ error: 'Natura non valida' });
    }

    if (name && name.trim() !== existingCategory.name) {
      const duplicateCategory = await prisma.category.findFirst({
        where: { userId, name: name.trim(), type: existingCategory.type, id: { not: id } },
      });
      if (duplicateCategory) {
        return res.status(409).json({ error: 'Esiste già una categoria con questo nome e tipo' });
      }
    }

    // parentId: stringa = sposta sotto quella macro, null = diventa macro.
    const moving = parentId !== undefined && (parentId || null) !== existingCategory.parentId;
    if (moving && parentId) {
      await assertValidParent({ userId, parentId, type: existingCategory.type, categoryId: id });
    }
    const willBeChild = moving ? !!parentId : !!existingCategory.parentId;

    const category = await prisma.category.update({
      where: { id },
      data: {
        ...(name && { name: name.trim() }),
        ...(color !== undefined && { color }),
        ...(icon !== undefined && { icon }),
        ...(moving && { parentId: parentId || null }),
        ...(willBeChild ? { nature: null } : nature !== undefined ? { nature } : {}),
      },
      include: categoryInclude,
    });

    analyticsCache.onCategoryMutated(userId);
    res.json(category);
  } catch (error) {
    handleRuleError(res, error, 'Update category error:');
  }
};

// Riordina categorie sorelle: body { ids: string[] } nell'ordine voluto.
export const reorderCategories = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { ids } = req.body || {};
    if (!Array.isArray(ids) || ids.length === 0 || ids.some((x) => typeof x !== 'string')) {
      return res.status(400).json({ error: 'Ordine non valido' });
    }
    const cats = await prisma.category.findMany({ where: { userId, id: { in: ids } }, select: { id: true, parentId: true, type: true } });
    if (cats.length !== ids.length) return res.status(404).json({ error: 'Categoria non trovata' });
    const sameGroup = cats.every((c) => c.parentId === cats[0].parentId && c.type === cats[0].type);
    if (!sameGroup) return res.status(400).json({ error: 'Puoi riordinare solo categorie dello stesso gruppo' });

    await prisma.$transaction(ids.map((cid: string, i: number) => prisma.category.update({ where: { id: cid }, data: { sortOrder: i } })));
    res.json({ message: 'Ordine aggiornato' });
  } catch (error) {
    console.error('Reorder categories error:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
};

// Archivia (con le sue sotto-categorie) / ripristina. Lo storico resta intatto.
export const archiveCategory = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const category = await prisma.category.findFirst({ where: { id, userId } });
    if (!category) return res.status(404).json({ error: 'Categoria non trovata' });
    if (category.isSystem) return res.status(403).json({ error: 'Questa categoria è gestita dal sistema' });

    const now = new Date();
    await prisma.category.updateMany({
      where: { userId, OR: [{ id }, { parentId: id }], archivedAt: null },
      data: { archivedAt: now },
    });
    analyticsCache.onCategoryMutated(userId);
    res.json({ message: 'Categoria archiviata: non compare più tra le scelte, lo storico resta' });
  } catch (error) {
    console.error('Archive category error:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
};

export const restoreCategory = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const category = await prisma.category.findFirst({ where: { id, userId } });
    if (!category) return res.status(404).json({ error: 'Categoria non trovata' });

    // Ripristinare una sotto-categoria ripristina anche la sua macro (altrimenti
    // resterebbe invisibile); ripristinare una macro ripristina le sue sotto-categorie.
    const ids = [id, ...(category.parentId ? [category.parentId] : [])];
    await prisma.category.updateMany({
      where: { userId, OR: [{ id: { in: ids } }, { parentId: id }] },
      data: { archivedAt: null },
    });
    analyticsCache.onCategoryMutated(userId);
    res.json({ message: `${category.name} è di nuovo disponibile` });
  } catch (error) {
    console.error('Restore category error:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
};

// Cosa usa una categoria (per la conferma di eliminazione/unione).
export const getCategoryUsage = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const category = await prisma.category.findFirst({ where: { id, userId } });
    if (!category) return res.status(404).json({ error: 'Categoria non trovata' });
    res.json(await categoryUsage(userId, id));
  } catch (error) {
    console.error('Category usage error:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
};

// Unisce la categoria in un'altra: body { targetId }.
export const mergeCategories = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { targetId } = req.body || {};
    if (typeof targetId !== 'string' || !targetId) return res.status(400).json({ error: 'Scegli la categoria di destinazione' });

    const result = await mergeCategory(userId, id, targetId);
    analyticsCache.onCategoryMutated(userId);
    analyticsCache.onTransactionMutated(userId);
    res.json({ message: 'Categorie unite', ...result });
  } catch (error) {
    handleRuleError(res, error, 'Merge category error:');
  }
};

// Elimina una categoria. Se è in uso (movimenti, ricorrenti, pianificate, piani,
// budget, sotto-categorie, stipendio) serve ?targetId= : tutto viene spostato lì.
export const deleteCategory = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const targetId = (typeof req.query.targetId === 'string' && req.query.targetId) || (req.body?.targetId as string | undefined);

    const category = await prisma.category.findFirst({ where: { id, userId } });
    if (!category) return res.status(404).json({ error: 'Categoria non trovata' });
    if (category.isSystem) {
      return res.status(403).json({ error: 'Questa categoria è gestita dal sistema e non può essere eliminata' });
    }

    if (targetId) {
      await mergeCategory(userId, id, targetId);
      analyticsCache.onCategoryMutated(userId);
      analyticsCache.onTransactionMutated(userId);
      return res.json({ message: 'Categoria eliminata: i suoi movimenti sono stati spostati' });
    }

    const usage = await categoryUsage(userId, id);
    if (usageTotal(usage) > 0) {
      return res.status(409).json({ error: 'La categoria è in uso: scegli dove spostare i suoi movimenti', usage });
    }

    await prisma.category.delete({ where: { id } });
    analyticsCache.onCategoryMutated(userId);
    res.json({ message: 'Categoria eliminata con successo' });
  } catch (error) {
    handleRuleError(res, error, 'Delete category error:');
  }
};

// ── Organizza categorie (utenti con categorie piatte o senza i predefiniti) ──

// GET /categories/organize → proposta di collocazione per ogni categoria personale
// senza macro, e quante categorie predefinite mancano.
export const getOrganizePreview = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const cats = await prisma.category.findMany({
      where: { userId, isSystem: false, archivedAt: null },
      select: { id: true, name: true, type: true, icon: true, color: true, parentId: true, templateKey: true, _count: { select: { children: true } } },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });
    const names = new Set(cats.map((c) => `${c.type}:${c.name.toLowerCase()}`));
    const missingDefaults = DEFAULT_CATEGORIES.reduce(
      (n, m) => n + (names.has(`${m.type}:${m.name.toLowerCase()}`) ? 0 : 1)
        + m.children.filter((c) => !names.has(`${m.type}:${c.name.toLowerCase()}`)).length,
      0,
    );

    const candidates = cats.filter((c) => !c.parentId && !c.templateKey);
    res.json({
      categories: candidates.map((c) => ({
        id: c.id, name: c.name, type: c.type, icon: c.icon, color: c.color,
        hasChildren: c._count.children > 0,
        suggestion: suggestPlacement(c.name, c.type),
      })),
      macros: DEFAULT_CATEGORIES.map((m) => ({ key: m.key, name: m.name, type: m.type, icon: m.icon })),
      missingDefaults,
    });
  } catch (error) {
    console.error('Organize preview error:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
};

// POST /categories/organize  body: { assignments: [{ categoryId, macroKey|null }], addDefaults }
//   macroKey null = resta macro personale. Una categoria con lo stesso nome di una
//   macro predefinita DIVENTA quella macro invece di finirci sotto.
export const applyOrganize = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { assignments, addDefaults } = req.body || {};
    if (!Array.isArray(assignments)) return res.status(400).json({ error: 'Dati non validi' });

    const ids = (assignments as { categoryId?: unknown }[]).map((a) => a?.categoryId).filter((x: unknown) => typeof x === 'string');
    const cats = await prisma.category.findMany({
      where: { userId, id: { in: ids }, isSystem: false },
      include: { _count: { select: { children: true } } },
    });
    const catById = new Map(cats.map((c) => [c.id, c]));

    await prisma.$transaction(async (tx) => {
      const macroIds = new Map<string, string>();
      // Macro predefinita per chiave: una categoria dell'utente con quella templateKey
      // o con lo stesso nome (senza macro); altrimenti la crea.
      const ensureMacro = async (key: string): Promise<string | null> => {
        if (macroIds.has(key)) return macroIds.get(key)!;
        const tpl = templateByKey(key);
        if (!tpl) return null;
        const found = await tx.category.findFirst({
          where: { userId, type: tpl.type, parentId: null, OR: [{ templateKey: key }, { name: tpl.name }] },
          select: { id: true },
        });
        const id = found
          ? found.id
          : (await tx.category.create({
              data: { userId, name: tpl.name, type: tpl.type, icon: tpl.icon, color: tpl.color, nature: tpl.nature ?? null, templateKey: key },
              select: { id: true },
            })).id;
        if (found) await tx.category.update({ where: { id: found.id }, data: { templateKey: key, archivedAt: null } });
        macroIds.set(key, id);
        return id;
      };

      for (const a of assignments as Array<{ categoryId: string; macroKey: string | null }>) {
        const cat = catById.get(a.categoryId);
        if (!cat || !a.macroKey) continue;
        const tpl = templateByKey(a.macroKey);
        if (!tpl || tpl.type !== cat.type) continue;
        if (cat.name.toLowerCase() === tpl.name.toLowerCase()) {
          // Stesso nome della macro: è la macro.
          await tx.category.update({ where: { id: cat.id }, data: { templateKey: tpl.key, parentId: null, nature: cat.nature ?? tpl.nature ?? null } });
          macroIds.set(tpl.key, cat.id);
          continue;
        }
        if (cat._count.children > 0) continue; // una macro personale con figli resta macro
        const macroId = await ensureMacro(tpl.key);
        if (!macroId) continue;
        // Sotto-categoria predefinita di cui prende il posto (nome uguale o parola
        // chiave), se ancora libera: evita il doppione aggiungendo le predefinite.
        const guess = suggestPlacement(cat.name, cat.type);
        const childKey = guess.macroKey === tpl.key ? guess.childKey : null;
        const taken = childKey ? await tx.category.findFirst({ where: { userId, templateKey: childKey }, select: { id: true } }) : null;
        await tx.category.update({
          where: { id: cat.id },
          data: { parentId: macroId, nature: null, ...(childKey && !taken && { templateKey: childKey }) },
        });
      }

      if (addDefaults) await seedDefaultCategories(userId, {}, tx);
      await normalizeCategoryOrder(userId, tx);

      // Stipendio: se non impostato, usa la categoria predefinita (o omonima).
      const user = await tx.user.findUnique({ where: { id: userId }, select: { salaryCategoryId: true } });
      if (!user?.salaryCategoryId) {
        const salary = await tx.category.findFirst({
          where: { userId, type: 'INCOME', OR: [{ templateKey: SALARY_TEMPLATE_KEY }, { name: 'Stipendio' }] },
          select: { id: true },
        });
        if (salary) await tx.user.update({ where: { id: userId }, data: { salaryCategoryId: salary.id } });
      }
    });

    analyticsCache.onCategoryMutated(userId);
    analyticsCache.onPayPeriodChanged(userId);
    res.json({ message: 'Categorie organizzate' });
  } catch (error) {
    handleRuleError(res, error, 'Organize categories error:');
  }
};
