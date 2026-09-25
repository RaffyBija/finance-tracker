import { describe, it, expect, vi, beforeEach } from 'vitest';

// transaction.controller importa il singleton prisma e utils che lo usano:
// mockiamo prisma con un findMany controllabile così possiamo testare sia la
// funzione pura sia i guard del controller senza un DB reale.
const { findMany } = vi.hoisted(() => ({ findMany: vi.fn() }));
vi.mock('../../utils/prisma', () => ({
  default: { transaction: { findMany } },
}));

import { pickSuggestedCategory, suggestCategory } from '../../controllers/transaction.controller';

describe('pickSuggestedCategory', () => {
  it('ritorna null su lista vuota', () => {
    expect(pickSuggestedCategory([])).toBeNull();
  });

  it('ignora le voci senza categoria', () => {
    expect(pickSuggestedCategory([{ categoryId: null }, { categoryId: null }])).toBeNull();
  });

  it('sceglie la categoria più frequente', () => {
    const matches = [
      { categoryId: 'a' },
      { categoryId: 'b' },
      { categoryId: 'b' },
      { categoryId: 'b' },
      { categoryId: 'a' },
    ];
    expect(pickSuggestedCategory(matches)).toBe('b');
  });

  it('a parità di frequenza vince la più recente (prima nella lista desc)', () => {
    // lista ordinata per data desc: 'a' è la prima (più recente)
    const matches = [{ categoryId: 'a' }, { categoryId: 'b' }];
    expect(pickSuggestedCategory(matches)).toBe('a');
  });

  it('salta i null ma conta le categorie valide', () => {
    const matches = [
      { categoryId: null },
      { categoryId: 'x' },
      { categoryId: null },
      { categoryId: 'x' },
    ];
    expect(pickSuggestedCategory(matches)).toBe('x');
  });
});

describe('suggestCategory controller — guard', () => {
  const makeRes = () => {
    const res: any = {};
    res.json = vi.fn().mockReturnValue(res);
    res.status = vi.fn().mockReturnValue(res);
    return res;
  };
  const run = async (query: any) => {
    const req: any = { userId: 'u1', query };
    const res = makeRes();
    await suggestCategory(req, res);
    return res;
  };

  beforeEach(() => {
    findMany.mockReset();
  });

  it('descrizione < 2 caratteri → categoryId null senza query', async () => {
    const res = await run({ description: 'a', type: 'EXPENSE' });
    expect(res.json).toHaveBeenCalledWith({ categoryId: null });
    expect(findMany).not.toHaveBeenCalled();
  });

  it('solo spazi → categoryId null senza query', async () => {
    const res = await run({ description: '   ', type: 'EXPENSE' });
    expect(res.json).toHaveBeenCalledWith({ categoryId: null });
    expect(findMany).not.toHaveBeenCalled();
  });

  it('tipo invalido → categoryId null senza query', async () => {
    const res = await run({ description: 'esselunga', type: 'FOO' });
    expect(res.json).toHaveBeenCalledWith({ categoryId: null });
    expect(findMany).not.toHaveBeenCalled();
  });

  it('nessun match nello storico → categoryId null', async () => {
    findMany.mockResolvedValue([]);
    const res = await run({ description: 'esselunga', type: 'EXPENSE' });
    expect(findMany).toHaveBeenCalledOnce();
    expect(res.json).toHaveBeenCalledWith({ categoryId: null });
  });

  it('match nello storico → ritorna la categoria più frequente', async () => {
    findMany.mockResolvedValue([{ categoryId: 'spesa' }, { categoryId: 'spesa' }]);
    const res = await run({ description: 'esselunga', type: 'EXPENSE' });
    expect(res.json).toHaveBeenCalledWith({ categoryId: 'spesa' });
  });

  it('500 su errore del DB', async () => {
    findMany.mockRejectedValue(new Error('boom'));
    const res = await run({ description: 'esselunga', type: 'EXPENSE' });
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Errore del server' });
  });
});
