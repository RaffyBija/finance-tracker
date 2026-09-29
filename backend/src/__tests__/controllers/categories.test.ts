import { describe, it, expect, vi, beforeEach } from 'vitest';
import prisma from '../../utils/prisma';
import { createCategory, updateCategory, deleteCategory, archiveCategory } from '../../controllers/category.controller';
import { mergeCategory } from '../../utils/categoryOps';

// Gerarchia a 2 livelli, eliminazione solo con destinazione se in uso, unione che
// sposta tutto (anche i budget, che prima diventavano "globali" per errore).
vi.mock('../../utils/prisma', () => {
  const model = () => ({
    findFirst: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(),
    updateMany: vi.fn(), delete: vi.fn(), deleteMany: vi.fn(), count: vi.fn(), aggregate: vi.fn(),
  });
  const client: any = {
    category: model(), transaction: model(), transactionItem: model(), recurringTransaction: model(),
    plannedTransaction: model(), installmentPlan: model(), budget: model(), user: model(),
    $transaction: vi.fn(),
  };
  return { default: client };
});

vi.mock('../../utils/analyticsCache', () => ({
  analyticsCache: new Proxy({}, { get: () => vi.fn() }),
}));

const p: any = prisma;

function mockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

const req = (body: object, params: object = {}, query: object = {}) => ({ userId: 'u1', body, params, query }) as any;
const zeroCounts = () => {
  for (const m of ['transaction', 'transactionItem', 'recurringTransaction', 'plannedTransaction', 'installmentPlan', 'budget', 'category']) {
    p[m].count.mockResolvedValue(0);
  }
  p.user.findUnique.mockResolvedValue({ salaryCategoryId: null });
};

beforeEach(() => {
  vi.clearAllMocks();
  p.$transaction.mockImplementation(async (cb: any) => (typeof cb === 'function' ? cb(p) : Promise.all(cb)));
  p.category.aggregate.mockResolvedValue({ _max: { sortOrder: 2 } });
  p.category.create.mockImplementation(async ({ data }: any) => ({ id: 'new', ...data }));
  p.category.update.mockImplementation(async ({ data }: any) => ({ id: 'c1', ...data }));
  zeroCounts();
});

describe('createCategory', () => {
  it('crea una sotto-categoria in coda ai fratelli, senza natura propria', async () => {
    p.category.findFirst
      .mockResolvedValueOnce(null) // nessun duplicato
      .mockResolvedValueOnce({ id: 'casa', type: 'EXPENSE', parentId: null, isSystem: false }); // macro
    const res = mockRes();
    await createCategory(req({ name: 'Giardino', type: 'EXPENSE', parentId: 'casa', nature: 'ESSENTIAL' }), res);
    const data = p.category.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ name: 'Giardino', parentId: 'casa', nature: null, sortOrder: 3 });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('niente terzo livello: il genitore dev\'essere una macro', async () => {
    p.category.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'bollette', type: 'EXPENSE', parentId: 'casa', isSystem: false });
    const res = mockRes();
    await createCategory(req({ name: 'Luce', type: 'EXPENSE', parentId: 'bollette' }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(p.category.create).not.toHaveBeenCalled();
  });

  it('il genitore deve avere lo stesso tipo', async () => {
    p.category.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'lavoro', type: 'INCOME', parentId: null, isSystem: false });
    const res = mockRes();
    await createCategory(req({ name: 'Pranzi', type: 'EXPENSE', parentId: 'lavoro' }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('updateCategory', () => {
  it('una macro con sotto-categorie non può diventare sotto-categoria', async () => {
    p.category.findFirst
      .mockResolvedValueOnce({ id: 'svago', type: 'EXPENSE', parentId: null, isSystem: false, name: 'Svago' })
      .mockResolvedValueOnce({ id: 'casa', type: 'EXPENSE', parentId: null, isSystem: false });
    p.category.count.mockResolvedValue(3); // figli di "svago"
    const res = mockRes();
    await updateCategory(req({ parentId: 'casa' }, { id: 'svago' }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(p.category.update).not.toHaveBeenCalled();
  });

  it('diventare macro permette di impostare la natura', async () => {
    p.category.findFirst.mockResolvedValueOnce({ id: 'c1', type: 'EXPENSE', parentId: 'casa', isSystem: false, name: 'Viaggi' });
    const res = mockRes();
    await updateCategory(req({ parentId: null, nature: 'DISCRETIONARY' }, { id: 'c1' }), res);
    expect(p.category.update.mock.calls[0][0].data).toMatchObject({ parentId: null, nature: 'DISCRETIONARY' });
  });
});

describe('deleteCategory', () => {
  it('in uso e senza destinazione → 409 con gli utilizzi', async () => {
    p.category.findFirst.mockResolvedValue({ id: 'c1', isSystem: false });
    p.transaction.count.mockResolvedValue(12);
    p.budget.count.mockResolvedValue(1);
    const res = mockRes();
    await deleteCategory(req({}, { id: 'c1' }), res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json.mock.calls[0][0].usage).toMatchObject({ transactions: 12, budgets: 1 });
    expect(p.category.delete).not.toHaveBeenCalled();
  });

  it('non usata → eliminata subito', async () => {
    p.category.findFirst.mockResolvedValue({ id: 'c1', isSystem: false });
    const res = mockRes();
    await deleteCategory(req({}, { id: 'c1' }), res);
    expect(p.category.delete).toHaveBeenCalledWith({ where: { id: 'c1' } });
  });

  it('la categoria di sistema non si elimina', async () => {
    p.category.findFirst.mockResolvedValue({ id: 'cc', isSystem: true });
    const res = mockRes();
    await deleteCategory(req({}, { id: 'cc' }), res);
    expect(res.status).toHaveBeenCalledWith(403);
  });
});

describe('mergeCategory', () => {
  const src = { id: 'src', userId: 'u1', type: 'EXPENSE', parentId: null, isSystem: false };

  it('sposta movimenti, righe divise, scadenze, budget, stipendio e sotto-categorie', async () => {
    p.category.findFirst.mockResolvedValueOnce(src).mockResolvedValueOnce({ id: 'dst', userId: 'u1', type: 'EXPENSE', parentId: null });
    p.budget.count.mockResolvedValue(0);
    await mergeCategory('u1', 'src', 'dst');
    for (const m of ['transaction', 'recurringTransaction', 'plannedTransaction', 'installmentPlan']) {
      expect(p[m].updateMany).toHaveBeenCalledWith({ where: { userId: 'u1', categoryId: 'src' }, data: { categoryId: 'dst' } });
    }
    expect(p.transactionItem.updateMany).toHaveBeenCalledWith({ where: { categoryId: 'src' }, data: { categoryId: 'dst' } });
    expect(p.budget.updateMany).toHaveBeenCalledWith({ where: { userId: 'u1', categoryId: 'src' }, data: { categoryId: 'dst' } });
    expect(p.category.updateMany).toHaveBeenCalledWith({ where: { userId: 'u1', parentId: 'src' }, data: { parentId: 'dst' } });
    expect(p.category.delete).toHaveBeenCalledWith({ where: { id: 'src' } });
  });

  it('se la destinazione ha già un budget, quelli dell\'origine vengono rimossi', async () => {
    p.category.findFirst.mockResolvedValueOnce(src).mockResolvedValueOnce({ id: 'dst', userId: 'u1', type: 'EXPENSE', parentId: null });
    p.budget.count.mockResolvedValue(1);
    p.budget.deleteMany.mockResolvedValue({ count: 2 });
    const r = await mergeCategory('u1', 'src', 'dst');
    expect(p.budget.deleteMany).toHaveBeenCalled();
    expect(r.budgetsRemoved).toBe(2);
  });

  it('destinazione sotto-categoria: i figli dell\'origine passano sotto la sua macro', async () => {
    p.category.findFirst.mockResolvedValueOnce(src).mockResolvedValueOnce({ id: 'dst', userId: 'u1', type: 'EXPENSE', parentId: 'macro' });
    p.budget.count.mockResolvedValue(0);
    await mergeCategory('u1', 'src', 'dst');
    expect(p.category.updateMany).toHaveBeenCalledWith({ where: { userId: 'u1', parentId: 'src' }, data: { parentId: 'macro' } });
  });

  it('tipi diversi → errore', async () => {
    p.category.findFirst.mockResolvedValueOnce(src).mockResolvedValueOnce({ id: 'dst', userId: 'u1', type: 'INCOME', parentId: null });
    await expect(mergeCategory('u1', 'src', 'dst')).rejects.toThrow('stesso tipo');
  });
});

describe('archiveCategory', () => {
  it('archivia la categoria e le sue sotto-categorie', async () => {
    p.category.findFirst.mockResolvedValue({ id: 'svago', isSystem: false });
    const res = mockRes();
    await archiveCategory(req({}, { id: 'svago' }), res);
    const arg = p.category.updateMany.mock.calls[0][0];
    expect(arg.where).toMatchObject({ userId: 'u1', OR: [{ id: 'svago' }, { parentId: 'svago' }] });
    expect(arg.data.archivedAt).toBeInstanceOf(Date);
  });
});
