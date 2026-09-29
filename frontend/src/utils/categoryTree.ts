import type { Category, TransactionType } from '../types';

// ── Albero delle categorie (macro → sotto-categorie) ─────────────────────────
//   Funzioni pure usate da selettore, pagina Categorie, Analisi e budget.

export interface CategoryNode {
  category: Category;
  children: Category[];
}

// Le categorie di sistema (es. "Pagamento Carta") in fondo.
const bySort = (a: Category, b: Category) =>
  Number(!!a.isSystem) - Number(!!b.isSystem)
  || (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
  || a.name.localeCompare(b.name, 'it');

// Macro ordinate, ciascuna con le sotto-categorie ordinate. Una sotto-categoria il
// cui genitore non è nella lista (es. filtrato) viene mostrata come macro.
export function buildCategoryTree(categories: Category[], type?: TransactionType): CategoryNode[] {
  const list = type ? categories.filter((c) => c.type === type) : categories;
  const ids = new Set(list.map((c) => c.id));
  const roots = list.filter((c) => !c.parentId || !ids.has(c.parentId)).sort(bySort);
  return roots.map((r) => ({
    category: r,
    children: list.filter((c) => c.parentId === r.id).sort(bySort),
  }));
}

// Lista piatta nell'ordine dell'albero (macro seguita dalle sue sotto-categorie).
export function flattenTree(tree: CategoryNode[]): { category: Category; depth: 0 | 1 }[] {
  return tree.flatMap((n) => [
    { category: n.category, depth: 0 as const },
    ...n.children.map((c) => ({ category: c, depth: 1 as const })),
  ]);
}

// "Macro › Sotto" (o solo il nome per una macro).
export function categoryPath(category: Category | undefined | null, all: Category[]): string {
  if (!category) return '';
  const parent = category.parentId ? all.find((c) => c.id === category.parentId) : undefined;
  return parent ? `${parent.name} › ${category.name}` : category.name;
}

// Macro di appartenenza (la categoria stessa se è una macro).
export function macroOf(category: Category | undefined | null, all: Category[]): Category | undefined {
  if (!category) return undefined;
  if (!category.parentId) return category;
  return all.find((c) => c.id === category.parentId) ?? category;
}

// Ricerca per nome su categoria e macro (senza accenti, maiuscole indifferenti).
export const normalizeSearch = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

export function matchesCategory(category: Category, query: string, all: Category[]): boolean {
  const q = normalizeSearch(query);
  if (!q) return true;
  return normalizeSearch(categoryPath(category, all)).includes(q);
}
