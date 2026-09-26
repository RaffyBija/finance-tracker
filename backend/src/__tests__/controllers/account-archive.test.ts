import { describe, it, expect, vi, beforeEach } from 'vitest';
import prisma from '../../utils/prisma';
import { getAccountsWithBalances } from '../../utils/balance';
import { deleteAccount, restoreAccount } from '../../controllers/account.controller';

// Eliminare un conto con movimenti lo ARCHIVIA: storico intatto, scadenze future
// e carte collegate passano al conto principale. Senza movimenti: eliminazione.
vi.mock('../../utils/prisma', () => {
  const client: any = {
    account: { findFirst: vi.fn(), delete: vi.fn(), update: vi.fn(), updateMany: vi.fn(), count: vi.fn() },
    user: { findUnique: vi.fn() },
    transaction: { count: vi.fn() },
    recurringTransaction: { count: vi.fn(), updateMany: vi.fn() },
    plannedTransaction: { count: vi.fn(), updateMany: vi.fn() },
    installmentPlan: { count: vi.fn(), updateMany: vi.fn() },
    billingCycle: { count: vi.fn() },
    $transaction: vi.fn(),
  };
  return { default: client };
});

vi.mock('../../utils/balance', () => ({ getAccountsWithBalances: vi.fn() }));
vi.mock('../../utils/billingCycle', () => ({}));
vi.mock('../../utils/analyticsCache', () => ({
  analyticsCache: new Proxy({}, { get: () => vi.fn() }),
}));

const p: any = prisma;
const balances = getAccountsWithBalances as unknown as ReturnType<typeof vi.fn>;

function mockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

const req = { userId: 'u1', params: { id: 'poste' } } as any;
const poste = { id: 'poste', userId: 'u1', name: 'PostePay', type: 'BANK', isDefault: false, archivedAt: null };
const main = { id: 'main', userId: 'u1', name: 'Intesa', type: 'BANK', isDefault: true, archivedAt: null };

const counts = (n: { tx?: number; rec?: number; planned?: number; plans?: number; cycles?: number }) => {
  p.transaction.count.mockResolvedValue(n.tx ?? 0);
  p.recurringTransaction.count.mockResolvedValue(n.rec ?? 0);
  p.plannedTransaction.count.mockResolvedValue(n.planned ?? 0);
  p.installmentPlan.count.mockResolvedValue(n.plans ?? 0);
  p.billingCycle.count.mockResolvedValue(n.cycles ?? 0);
};

beforeEach(() => {
  vi.clearAllMocks();
  p.account.findFirst.mockImplementation(async ({ where }: any) => (where.isDefault ? main : poste));
  p.$transaction.mockImplementation(async (cb: any) => cb(p));
  p.recurringTransaction.updateMany.mockResolvedValue({ count: 2 });
  p.plannedTransaction.updateMany.mockResolvedValue({ count: 1 });
  p.installmentPlan.updateMany.mockResolvedValue({ count: 0 });
  p.account.updateMany.mockResolvedValue({ count: 0 });
});

describe('deleteAccount', () => {
  it('senza movimenti elimina definitivamente', async () => {
    counts({});
    const res = mockRes();
    await deleteAccount(req, res);
    expect(p.account.delete).toHaveBeenCalledWith({ where: { id: 'poste' } });
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ archived: false }));
  });

  it('con movimenti archivia e sposta le scadenze future sul conto principale', async () => {
    counts({ tx: 40, rec: 2 });
    balances.mockResolvedValue([{ id: 'poste', type: 'BANK', balance: 0 }]);
    const res = mockRes();
    await deleteAccount(req, res);

    expect(p.account.delete).not.toHaveBeenCalled();
    // Anche le ricorrenti in pausa: riattivate non devono scrivere sul conto archiviato.
    expect(p.recurringTransaction.updateMany).toHaveBeenCalledWith({
      where: { accountId: 'poste' }, data: { accountId: 'main' },
    });
    expect(p.plannedTransaction.updateMany).toHaveBeenCalledWith({
      where: { accountId: 'poste', isPaid: false }, data: { accountId: 'main' },
    });
    expect(p.account.updateMany).toHaveBeenCalledWith({
      where: { linkedAccountId: 'poste', archivedAt: null }, data: { linkedAccountId: 'main' },
    });
    const archive = p.account.update.mock.calls[0][0];
    expect(archive.where).toEqual({ id: 'poste' });
    expect(archive.data.archivedAt).toBeInstanceOf(Date);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      archived: true, moved: { recurring: 2, planned: 1, plans: 0, cards: 0 },
    }));
  });

  it('rifiuta l\'archiviazione con saldo diverso da zero', async () => {
    counts({ tx: 3 });
    balances.mockResolvedValue([{ id: 'poste', type: 'BANK', balance: 12.5 }]);
    const res = mockRes();
    await deleteAccount(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(p.account.update).not.toHaveBeenCalled();
  });

  it('carta con addebiti di cicli chiusi non registrati → 400', async () => {
    const card = { ...poste, id: 'cc', type: 'CREDIT_CARD' };
    p.account.findFirst.mockImplementation(async ({ where }: any) => (where.isDefault ? main : card));
    counts({ tx: 5, planned: 1 });
    balances.mockResolvedValue([{ id: 'cc', type: 'CREDIT_CARD', balance: 0 }]);
    p.plannedTransaction.count.mockResolvedValue(1); // include l'addebito non pagato (ccAccountId)
    const res = mockRes();
    await deleteAccount({ userId: 'u1', params: { id: 'cc' } } as any, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(p.account.update).not.toHaveBeenCalled();
  });

  it('senza conto principale attivo non archivia', async () => {
    p.account.findFirst.mockImplementation(async ({ where }: any) => (where.isDefault ? null : poste));
    counts({ tx: 2 });
    balances.mockResolvedValue([{ id: 'poste', type: 'BANK', balance: 0 }]);
    const res = mockRes();
    await deleteAccount(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(p.account.update).not.toHaveBeenCalled();
  });

  it('il conto principale non si elimina', async () => {
    p.account.findFirst.mockResolvedValue(main);
    const res = mockRes();
    await deleteAccount({ userId: 'u1', params: { id: 'main' } } as any, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('restoreAccount', () => {
  it('riattiva un conto archiviato', async () => {
    p.account.findFirst.mockResolvedValue({ ...poste, archivedAt: new Date() });
    p.user.findUnique.mockResolvedValue({ isPro: false });
    p.account.count.mockResolvedValue(1);
    const res = mockRes();
    await restoreAccount(req, res);
    expect(p.account.update).toHaveBeenCalledWith({ where: { id: 'poste' }, data: { archivedAt: null } });
    expect(res.status).not.toHaveBeenCalled();
  });

  it('rispetta il limite di conti del piano', async () => {
    p.account.findFirst.mockResolvedValue({ ...poste, archivedAt: new Date() });
    p.user.findUnique.mockResolvedValue({ isPro: false });
    p.account.count.mockResolvedValue(3);
    const res = mockRes();
    await restoreAccount(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(p.account.update).not.toHaveBeenCalled();
  });
});
