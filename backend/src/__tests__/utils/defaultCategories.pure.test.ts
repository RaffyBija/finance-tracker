import { describe, it, expect } from 'vitest';
import { DEFAULT_CATEGORIES, SALARY_TEMPLATE_KEY, suggestPlacement } from '../../utils/defaultCategories';

describe('DEFAULT_CATEGORIES', () => {
  it('nomi unici per tipo (vincolo [userId, name, type]) e chiavi uniche', () => {
    const names = new Set<string>();
    const keys = new Set<string>();
    for (const m of DEFAULT_CATEGORIES) {
      for (const c of [m, ...m.children]) {
        const n = `${m.type}:${c.name.toLowerCase()}`;
        expect(names.has(n), `nome duplicato ${n}`).toBe(false);
        expect(keys.has(c.key), `chiave duplicata ${c.key}`).toBe(false);
        names.add(n);
        keys.add(c.key);
      }
    }
  });

  it('natura solo sulle macro di uscita; stipendio presente tra le entrate', () => {
    for (const m of DEFAULT_CATEGORIES) {
      if (m.type === 'INCOME') expect(m.nature).toBeUndefined();
      else expect(['ESSENTIAL', 'DISCRETIONARY']).toContain(m.nature);
    }
    const salary = DEFAULT_CATEGORIES.flatMap((m) => m.children).find((c) => c.key === SALARY_TEMPLATE_KEY);
    expect(salary?.name).toBe('Stipendio');
  });
});

describe('suggestPlacement', () => {
  it('nome uguale a una macro → è quella macro', () => {
    expect(suggestPlacement('Casa', 'EXPENSE')).toEqual({ role: 'macro', macroKey: 'expense.home', childKey: null });
  });

  it('nome uguale a una sotto-categoria (senza badare ad accenti e maiuscole) → è quella', () => {
    expect(suggestPlacement('spesa', 'EXPENSE')).toEqual({ role: 'child', macroKey: 'expense.food', childKey: 'expense.food.groceries' });
    expect(suggestPlacement('Bar e caffe', 'EXPENSE')).toMatchObject({ macroKey: 'expense.eatout', childKey: 'expense.eatout.bar' });
  });

  it('parole chiave → sotto la macro giusta, al posto della sotto-categoria corrispondente', () => {
    expect(suggestPlacement('Benzina', 'EXPENSE')).toEqual({ role: 'child', macroKey: 'expense.transport', childKey: 'expense.transport.fuel' });
    expect(suggestPlacement('Affitto', 'EXPENSE')).toMatchObject({ macroKey: 'expense.home', childKey: 'expense.home.rent' });
    // Solo parola chiave della macro: finisce sotto la macro, senza sotto-categoria.
    expect(suggestPlacement('Spese per la casa', 'EXPENSE')).toEqual({ role: 'child', macroKey: 'expense.home', childKey: null });
    expect(suggestPlacement('Netflix e Spotify', 'EXPENSE')).toMatchObject({ macroKey: 'expense.leisure' });
    expect(suggestPlacement('Bollette luce', 'EXPENSE')).toMatchObject({ macroKey: 'expense.home' });
    expect(suggestPlacement('Stipendio scuola', 'INCOME')).toMatchObject({ macroKey: 'income.work' });
  });

  it('le parole chiave corte valgono solo come parola intera', () => {
    // "bar" non deve scattare dentro "barca"
    expect(suggestPlacement('Barca', 'EXPENSE')).toEqual({ role: null, macroKey: null, childKey: null });
  });

  it('il tipo conta: un nome di uscita non finisce tra le entrate', () => {
    expect(suggestPlacement('Casa', 'INCOME').macroKey).toBeNull();
  });
});
