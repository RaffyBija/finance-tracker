import { describe, it, expect, vi, beforeEach } from 'vitest';
import prisma from '../../utils/prisma';
import { userHasAccounts, accountBelongsToUser } from '../../utils/ownership';
import { createTransaction, updateTransaction } from '../../controllers/transaction.controller';
import { markAsPaid, createPlannedTransaction, updatePlannedTransaction } from '../../controllers/planned.controller';
import { executeRecurring, createRecurringTransaction } from '../../controllers/recurring.controller';
import { payInstallments } from '../../controllers/installment.controller';

// Con almeno un conto, nessun movimento può nascere (o restare) senza conto:
// saldi, proiezione e ritmo quotidiano contano solo le transazioni con conto.
vi.mock('../../utils/prisma', () => {
  const client: any = {
    transaction: { create: vi.fn(), findFirst: vi.fn() },
    plannedTransaction: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn() },
    recurringTransaction: { findMany: vi.fn(), create: vi.fn() },
    installmentPlan: { findFirst: vi.fn() },
    category: { findFirst: vi.fn() },
    account: { findMany: vi.fn() },
    $transaction: vi.fn(),
  };
  return { default: client };
});

vi.mock('../../utils/ownership', () => ({
  ACCOUNT_REQUIRED_ERROR: 'Seleziona un conto',
  userHasAccounts: vi.fn(),
  accountBelongsToUser: vi.fn(),
}));

vi.mock('../../utils/billingCycle', () => ({
  reconcileCcChanges: vi.fn().mockResolvedValue(false),
  debtContribution: () => 0,
}));

vi.mock('../../utils/analyticsCache', () => ({
  analyticsCache: new Proxy({}, { get: () => vi.fn() }),
}));

const p: any = prisma;
const hasAccounts = userHasAccounts as unknown as ReturnType<typeof vi.fn>;
const owns = accountBelongsToUser as unknown as ReturnType<typeof vi.fn>;

function mockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

const req = (body: object, params: object = {}) => ({ userId: 'u1', body, params }) as any;

beforeEach(() => {
  vi.clearAllMocks();
  hasAccounts.mockResolvedValue(true);
  owns.mockResolvedValue(true);
  p.account.findMany.mockResolvedValue([]);
});

describe('transazioni', () => {
  it('create senza conto → 400 se l\'utente ha dei conti', async () => {
    const res = mockRes();
    await createTransaction(req({ amount: 10, type: 'EXPENSE' }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Seleziona un conto' });
    expect(p.transaction.create).not.toHaveBeenCalled();
  });

  it('create senza conto consentita per chi non ha conti', async () => {
    hasAccounts.mockResolvedValue(false);
    p.transaction.create.mockResolvedValue({ id: 't1', amount: 10, type: 'EXPENSE', accountId: null, items: [] });
    const res = mockRes();
    await createTransaction(req({ amount: 10, type: 'EXPENSE' }), res);
    expect(p.transaction.create).toHaveBeenCalled();
  });

  it('update di una vecchia transazione senza conto richiede di sceglierne uno', async () => {
    p.transaction.findFirst.mockResolvedValue({ id: 't1', userId: 'u1', accountId: null, transferId: null, type: 'EXPENSE' });
    const res = mockRes();
    await updateTransaction(req({ amount: 12 }, { id: 't1' }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Seleziona un conto' });
  });
});

describe('ricorrenti e pianificate', () => {
  it('create ricorrente senza conto → 400', async () => {
    const res = mockRes();
    await createRecurringTransaction(req({
      amount: 10, type: 'EXPENSE', description: 'Netflix', frequency: 'MONTHLY', dayOfMonth: 5, startDate: '2026-09-01',
    }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(p.recurringTransaction.create).not.toHaveBeenCalled();
  });

  it('create pianificata senza conto → 400', async () => {
    const res = mockRes();
    await createPlannedTransaction(req({ amount: 10, type: 'EXPENSE', description: 'Bollo', plannedDate: '2026-10-01' }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(p.plannedTransaction.create).not.toHaveBeenCalled();
  });

  it('non si può togliere il conto a una pianificata', async () => {
    p.plannedTransaction.findFirst.mockResolvedValue({ id: 'p1', userId: 'u1', type: 'EXPENSE', planId: null, accountId: 'a1' });
    const res = mockRes();
    await updatePlannedTransaction(req({ accountId: '' }, { id: 'p1' }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('registrazione delle scadenze', () => {
  it('markAsPaid di una pianificata senza conto → 400', async () => {
    p.plannedTransaction.findFirst.mockResolvedValue({
      id: 'p1', userId: 'u1', amount: 30, type: 'EXPENSE', description: 'Bolletta',
      categoryId: null, accountId: null, plannedDate: new Date('2026-09-10'), isPaid: false, planId: null,
    });
    const res = mockRes();
    await markAsPaid(req({}, { id: 'p1' }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(p.$transaction).not.toHaveBeenCalled();
  });

  it('markAsPaid usa il conto passato nel body', async () => {
    const planned = {
      id: 'p1', userId: 'u1', amount: 30, type: 'EXPENSE', description: 'Bolletta',
      categoryId: null, accountId: null, plannedDate: new Date('2026-09-10'), isPaid: false, planId: null,
    };
    p.plannedTransaction.findFirst.mockResolvedValue(planned);
    const tx: any = {
      transaction: { create: vi.fn(async ({ data }: any) => ({ id: 't1', ...data })) },
      plannedTransaction: { updateMany: vi.fn().mockResolvedValue({ count: 1 }), findUniqueOrThrow: vi.fn().mockResolvedValue(planned) },
    };
    p.$transaction.mockImplementation(async (cb: any) => cb(tx));
    const res = mockRes();
    await markAsPaid(req({ accountId: 'a2' }, { id: 'p1' }), res);
    expect(tx.transaction.create.mock.calls[0][0].data.accountId).toBe('a2');
    expect(res.status).not.toHaveBeenCalled();
  });

  it('executeRecurring rifiuta le ricorrenti senza conto elencandole', async () => {
    p.recurringTransaction.findMany.mockResolvedValue([
      { id: 'r1', description: 'Palestra', accountId: null },
      { id: 'r2', description: 'Netflix', accountId: 'a1' },
    ]);
    const res = mockRes();
    await executeRecurring(req({ ids: ['r1', 'r2'] }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Imposta un conto su: Palestra' });
    expect(p.transaction.create).not.toHaveBeenCalled();
  });

  it('executeRecurring rifiuta le ricorrenti su un conto archiviato', async () => {
    p.account.findMany.mockResolvedValue([{ id: 'old' }]);
    p.recurringTransaction.findMany.mockResolvedValue([{ id: 'r1', description: 'Palestra', accountId: 'old' }]);
    const res = mockRes();
    await executeRecurring(req({ ids: ['r1'] }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(p.transaction.create).not.toHaveBeenCalled();
  });

  it('payInstallments senza alcun conto risolvibile → 400', async () => {
    p.plannedTransaction.findMany.mockResolvedValue([{ id: 'i1', planId: 'pl1', type: 'EXPENSE', amount: 50, accountId: null }]);
    p.installmentPlan.findFirst.mockResolvedValue({ id: 'pl1', title: 'F24', accountId: null, categoryId: null });
    const res = mockRes();
    await payInstallments(req({ plannedIds: ['i1'] }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Indica il conto su cui registrare le rate' });
  });
});
