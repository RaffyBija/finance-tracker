import { describe, it, expect, vi, beforeEach } from 'vitest';
import prisma from '../../utils/prisma';
import { reconcileCcChanges } from '../../utils/billingCycle';
import { markAsPaid, deletePlannedTransaction, updatePlannedTransaction } from '../../controllers/planned.controller';
import { executeRecurring } from '../../controllers/recurring.controller';

// Registrazione delle scadenze dal popup "Scadenze da registrare":
// pianificate (markAsPaid) e ricorrenti (executeRecurring) con data effettiva.
vi.mock('../../utils/prisma', () => {
  const client: any = {
    plannedTransaction: { findFirst: vi.fn(), updateMany: vi.fn(), findUniqueOrThrow: vi.fn(), update: vi.fn(), delete: vi.fn() },
    recurringTransaction: { findMany: vi.fn(), update: vi.fn() },
    transaction: { create: vi.fn() },
    $transaction: vi.fn(),
  };
  return { default: client };
});

vi.mock('../../utils/billingCycle', () => ({
  reconcileCcChanges: vi.fn().mockResolvedValue(false),
  debtContribution: (type: string, amount: number) => (type === 'EXPENSE' ? amount : -amount),
}));

vi.mock('../../utils/analyticsCache', () => ({
  analyticsCache: { onPlannedMutated: vi.fn(), onPlannedPaid: vi.fn(), onRecurringExecuted: vi.fn() },
}));

const p: any = prisma;

function mockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

beforeEach(() => {
  vi.clearAllMocks();
  p.$transaction.mockImplementation(async (cb: any) => cb(p));
  p.transaction.create.mockImplementation(async ({ data }: any) => ({ id: 'tx1', ...data }));
});

describe('markAsPaid', () => {
  const planned = {
    id: 'p1', userId: 'u1', amount: 30, type: 'EXPENSE', description: 'Bolletta',
    categoryId: 'c1', accountId: 'cc1', plannedDate: new Date('2026-09-10'), isPaid: false,
  };

  it('usa la data passata e riconcilia il ciclo CC del conto', async () => {
    p.plannedTransaction.findFirst.mockResolvedValue(planned);
    p.plannedTransaction.updateMany.mockResolvedValue({ count: 1 });
    p.plannedTransaction.findUniqueOrThrow.mockResolvedValue({ ...planned, isPaid: true });

    const res = mockRes();
    await markAsPaid({ userId: 'u1', params: { id: 'p1' }, body: { date: '2026-09-12' } } as any, res);

    const txData = p.transaction.create.mock.calls[0][0].data;
    expect(txData.date).toEqual(new Date('2026-09-12'));
    expect(p.plannedTransaction.updateMany).toHaveBeenCalledWith({
      where: { id: 'p1', isPaid: false },
      data: { isPaid: true },
    });
    expect(reconcileCcChanges).toHaveBeenCalledWith('u1', [
      { accountId: 'cc1', date: new Date('2026-09-12'), signed: 30 },
    ]);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('409 se la pianificata risulta già pagata (doppio pagamento concorrente)', async () => {
    p.plannedTransaction.findFirst.mockResolvedValue(planned);
    p.plannedTransaction.updateMany.mockResolvedValue({ count: 0 });

    const res = mockRes();
    await markAsPaid({ userId: 'u1', params: { id: 'p1' }, body: {} } as any, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(reconcileCcChanges).not.toHaveBeenCalled();
  });
});

describe('executeRecurring', () => {
  // Mensile al giorno 1, iniziata nel 2020: la scadenza dovuta è sempre il 1° del mese corrente.
  const recurring = {
    id: 'r1', userId: 'u1', amount: 10, type: 'EXPENSE', description: 'Netflix', categoryId: 'c1',
    accountId: 'acc1', frequency: 'MONTHLY', dayOfMonth: 1, startDate: new Date('2020-01-01'),
    endDate: null, isActive: true, lastExecutedDate: null,
  };

  it('data effettiva sulla transazione, scadenza prevista su lastExecutedDate', async () => {
    p.recurringTransaction.findMany.mockResolvedValue([recurring]);

    const res = mockRes();
    await executeRecurring({ userId: 'u1', body: { ids: ['r1'], dates: { r1: '2026-09-03' } } } as any, res);

    const txData = p.transaction.create.mock.calls[0][0].data;
    expect(txData.date).toEqual(new Date('2026-09-03'));
    const lastExecuted: Date = p.recurringTransaction.update.mock.calls[0][0].data.lastExecutedDate;
    expect(lastExecuted.getDate()).toBe(1);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(reconcileCcChanges).toHaveBeenCalledTimes(1);
  });

  it('400 se una data non è valida', async () => {
    const res = mockRes();
    await executeRecurring({ userId: 'u1', body: { ids: ['r1'], dates: { r1: 'boh' } } } as any, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(p.transaction.create).not.toHaveBeenCalled();
  });
});

describe('/planned/:id sulle rate di un piano (guard planId)', () => {
  const rata = { id: 'r1', userId: 'u1', planId: 'plan1', amount: 50, type: 'EXPENSE', plannedDate: new Date(), isPaid: false };

  it.each([
    ['markAsPaid', markAsPaid, {}],
    ['delete', deletePlannedTransaction, {}],
    ['update', updatePlannedTransaction, { amount: 99 }],
  ])('%s → 400 senza toccare il DB', async (_name, handler: any, body) => {
    p.plannedTransaction.findFirst.mockResolvedValue(rata);
    const res = mockRes();
    await handler({ userId: 'u1', params: { id: 'r1' }, body } as any, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(p.transaction.create).not.toHaveBeenCalled();
    expect(p.plannedTransaction.update).not.toHaveBeenCalled();
    expect(p.plannedTransaction.delete).not.toHaveBeenCalled();
  });
});
