import { describe, it, expect, vi } from 'vitest';
import { seedDefaultCategories, normalizeCategoryOrder, DEFAULT_CATEGORIES } from '../../utils/defaultCategories';

// Creazione e riordino devono costare un numero FISSO di query (non una per categoria):
// dentro la transazione di "Organizza categorie" su DB remoto è ciò che evita P2028.
vi.mock('../../utils/prisma', () => ({ default: {} }));

const total = DEFAULT_CATEGORIES.reduce((n, m) => n + 1 + m.children.length, 0);

describe('seedDefaultCategories', () => {
  it('crea tutto con un solo createMany, macro prima dei figli, parentId coerenti', async () => {
    const db: any = {
      category: { findMany: vi.fn().mockResolvedValue([]), createMany: vi.fn().mockResolvedValue({}), create: vi.fn() },
      user: { findUnique: vi.fn() },
    };
    const { created } = await seedDefaultCategories('u1', {}, db);
    expect(created).toBe(total);
    expect(db.category.createMany).toHaveBeenCalledTimes(1);
    expect(db.category.create).not.toHaveBeenCalled();
    const data = db.category.createMany.mock.calls[0][0].data;
    const ids = new Set(data.filter((c: any) => c.id).map((c: any) => c.id));
    expect(data.filter((c: any) => c.parentId).every((c: any) => ids.has(c.parentId))).toBe(true);
    expect(data.findIndex((c: any) => c.parentId)).toBeGreaterThan(data.filter((c: any) => !c.parentId).length - 1);
  });

  it('non fa nulla se esiste già tutto', async () => {
    const existing = DEFAULT_CATEGORIES.flatMap((m) => [
      { id: m.key, name: m.name, type: m.type, templateKey: m.key },
      ...m.children.map((c) => ({ id: c.key, name: c.name, type: m.type, templateKey: c.key })),
    ]);
    const db: any = { category: { findMany: vi.fn().mockResolvedValue(existing), createMany: vi.fn() } };
    expect((await seedDefaultCategories('u1', {}, db)).created).toBe(0);
    expect(db.category.createMany).not.toHaveBeenCalled();
  });
});

describe('normalizeCategoryOrder', () => {
  it('aggiorna tutti gli ordini con un solo $executeRaw', async () => {
    const cats = Array.from({ length: 50 }, (_, i) => ({ id: `c${i}`, parentId: null, templateKey: null, name: `Cat ${String(50 - i).padStart(2, '0')}`, sortOrder: 999 }));
    const db: any = { category: { findMany: vi.fn().mockResolvedValue(cats), update: vi.fn() }, $executeRaw: vi.fn().mockResolvedValue(50) };
    await normalizeCategoryOrder('u1', db);
    expect(db.$executeRaw).toHaveBeenCalledTimes(1);
    expect(db.category.update).not.toHaveBeenCalled();
  });

  it('nessuna query se l\'ordine è già giusto', async () => {
    const db: any = { category: { findMany: vi.fn().mockResolvedValue([{ id: 'a', parentId: null, templateKey: null, name: 'A', sortOrder: 0 }]) }, $executeRaw: vi.fn() };
    await normalizeCategoryOrder('u1', db);
    expect(db.$executeRaw).not.toHaveBeenCalled();
  });
});
