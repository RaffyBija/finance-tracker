import { describe, it, expect } from 'vitest';
import { buildCategoryTree, flattenTree, categoryPath, macroOf, matchesCategory } from '../../utils/categoryTree';
import type { Category } from '../../types';

const cat = (id: string, name: string, over: Partial<Category> = {}): Category => ({
  id, name, type: 'EXPENSE', userId: 'u1', createdAt: '', updatedAt: '', ...over,
});

const all = [
  cat('casa', 'Casa', { sortOrder: 1 }),
  cat('bollette', 'Bollette', { parentId: 'casa', sortOrder: 1 }),
  cat('affitto', 'Affitto e mutuo', { parentId: 'casa', sortOrder: 0 }),
  cat('svago', 'Svago', { sortOrder: 0 }),
  cat('stip', 'Stipendio', { type: 'INCOME' }),
];

describe('categoryTree', () => {
  it('macro ordinate con sotto-categorie ordinate, filtrate per tipo', () => {
    const tree = buildCategoryTree(all, 'EXPENSE');
    expect(tree.map((n) => n.category.id)).toEqual(['svago', 'casa']);
    expect(tree[1].children.map((c) => c.id)).toEqual(['affitto', 'bollette']);
    expect(flattenTree(tree).map((x) => `${x.depth}:${x.category.id}`)).toEqual(['0:svago', '0:casa', '1:affitto', '1:bollette']);
  });

  it('una sotto-categoria senza la sua macro nella lista diventa radice', () => {
    const tree = buildCategoryTree([all[1]], 'EXPENSE');
    expect(tree.map((n) => n.category.id)).toEqual(['bollette']);
  });

  it('percorso, macro di appartenenza e ricerca anche sul nome della macro', () => {
    expect(categoryPath(all[1], all)).toBe('Casa › Bollette');
    expect(categoryPath(all[0], all)).toBe('Casa');
    expect(macroOf(all[1], all)?.id).toBe('casa');
    expect(matchesCategory(all[1], 'casa', all)).toBe(true);
    expect(matchesCategory(all[1], 'bollè', all)).toBe(true);
    expect(matchesCategory(all[3], 'casa', all)).toBe(false);
  });
});
