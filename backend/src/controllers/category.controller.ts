import { Response } from 'express';
import prisma from '../utils/prisma';
import { AuthRequest, CreateCategoryDTO } from '../types';

// Ottieni tutte le categorie dell'utente
export const getCategories = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { type } = req.query;

    const where: any = { userId };

    if (type && (type === 'INCOME' || type === 'EXPENSE')) {
      where.type = type;
    }

    const categories = await prisma.category.findMany({
      where,
      include: {
        _count: {
          select: { transactions: true },
        },
      },
      orderBy: {
        name: 'asc',
      },
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

    const category = await prisma.category.findFirst({
      where: {
        id,
        userId,
      },
      include: {
        _count: {
          select: { transactions: true },
        },
      },
    });

    if (!category) {
      return res.status(404).json({ error: 'Categoria non trovata' });
    }

    res.json(category);
  } catch (error) {
    console.error('Get category error:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
};

// Crea una nuova categoria
export const createCategory = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { name, type, color, icon }: CreateCategoryDTO = req.body;

    // Validazione
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Nome categoria obbligatorio' });
    }

    if (!type || (type !== 'INCOME' && type !== 'EXPENSE')) {
      return res.status(400).json({ error: 'Tipo non valido (INCOME o EXPENSE)' });
    }

    // Verifica che non esista già una categoria con lo stesso nome e tipo
    const existingCategory = await prisma.category.findFirst({
      where: {
        userId,
        name: name.trim(),
        type,
      },
    });

    if (existingCategory) {
      return res.status(409).json({ error: 'Esiste già una categoria con questo nome e tipo' });
    }

    const category = await prisma.category.create({
      data: {
        name: name.trim(),
        type,
        color,
        icon,
        userId,
      },
    });

    res.status(201).json(category);
  } catch (error) {
    console.error('Create category error:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
};

// Aggiorna una categoria
export const updateCategory = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { name, color, icon } = req.body;

    // Verifica che la categoria esista e appartenga all'utente
    const existingCategory = await prisma.category.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!existingCategory) {
      return res.status(404).json({ error: 'Categoria non trovata' });
    }

    // Se viene cambiato il nome, verifica che non esista già
    if (name && name.trim() !== existingCategory.name) {
      const duplicateCategory = await prisma.category.findFirst({
        where: {
          userId,
          name: name.trim(),
          type: existingCategory.type,
          id: { not: id },
        },
      });

      if (duplicateCategory) {
        return res.status(409).json({ error: 'Esiste già una categoria con questo nome e tipo' });
      }
    }

    const category = await prisma.category.update({
      where: { id },
      data: {
        ...(name && { name: name.trim() }),
        ...(color !== undefined && { color }),
        ...(icon !== undefined && { icon }),
      },
    });

    res.json(category);
  } catch (error) {
    console.error('Update category error:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
};

// Elimina una categoria
export const deleteCategory = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    // Verifica che la categoria esista e appartenga all'utente
    const category = await prisma.category.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!category) {
      return res.status(404).json({ error: 'Categoria non trovata' });
    }

    // Le transazioni collegate verranno automaticamente impostate a NULL (onDelete: SetNull)
    await prisma.category.delete({
      where: { id },
    });

    res.json({ message: 'Categoria eliminata con successo' });
  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
};