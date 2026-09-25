import { describe, it, expect, vi, beforeEach } from 'vitest';
import prisma from '../../utils/prisma';
import {
  createInstallmentPlan,
  getInstallmentPlans,
  payInstallments,
  deleteInstallmentPlan,
} from '../../controllers/installment.controller';

// Mock del singleton Prisma. $transaction esegue la callback passando il client
// stesso come `tx`, così tx.<model>.<op> punta agli stessi mock.
vi.mock('../../utils/prisma', () => {
  const client: any = {
    installmentPlan: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    plannedTransaction: {
      findMany: vi.fn(),
      createMany: vi.fn(),
      deleteMany: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
    },
    transaction: { create: vi.fn() },
    category: { findFirst: vi.fn() },
    $transaction: vi.fn(),
  };
  return { default: client };
});

vi.mock('../../utils/analyticsCache', () => ({
  analyticsCache: { onPlannedMutated: vi.fn(), onPlannedPaid: vi.fn() },
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
  // $transaction interattiva: esegue la callback con il client mock come tx.
  p.$transaction.mockImplementation(async (cb: any) => cb(p));
  p.installmentPlan.create.mockResolvedValue({ id: 'plan1' });
  p.installmentPlan.findUnique.mockResolvedValue({ id: 'plan1', title: 'X', installments: [] });
  p.plannedTransaction.createMany.mockResolvedValue({ count: 0 });
});

describe('createInstallmentPlan', () => {
  it('crea N rate EXPENSE per un DEBITO, con planId e totale = Σ rate', async () => {
    const req: any = {
      userId: 'u1',
      body: {
        direction: 'DEBT',
        title: 'F24 2026',
        installments: [
          { amount: 173.25, plannedDate: '2026-07-30' },
          { amount: 173.94, plannedDate: '2026-08-20' },
          { amount: 173.94, plannedDate: '2026-09-16' },
          { amount: 173.94, plannedDate: '2026-10-16' },
          { amount: 199.0, plannedDate: '2026-11-30' },
        ],
      },
    };
    const res = mockRes();

    await createInstallmentPlan(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    // totale del piano
    const planData = p.installmentPlan.create.mock.calls[0][0].data;
    expect(planData.totalAmount).toBeCloseTo(894.07, 2);
    expect(planData.direction).toBe('DEBT');
    // rate: 5, tutte EXPENSE, tutte collegate al piano
    const rows = p.plannedTransaction.createMany.mock.calls[0][0].data;
    expect(rows).toHaveLength(5);
    expect(rows.every((r: any) => r.type === 'EXPENSE')).toBe(true);
    expect(rows.every((r: any) => r.planId === 'plan1')).toBe(true);
  });

  it('crea rate INCOME per un CREDITO, con controparte per rata', async () => {
    const req: any = {
      userId: 'u1',
      body: {
        direction: 'CREDIT',
        title: 'Vacanza',
        installments: [
          { amount: 25, plannedDate: '2026-08-20', counterparty: 'Mario' },
          { amount: 40, plannedDate: '2026-08-30', counterparty: 'Pippo' },
        ],
      },
    };
    const res = mockRes();

    await createInstallmentPlan(req, res);

    const rows = p.plannedTransaction.createMany.mock.calls[0][0].data;
    expect(rows.every((r: any) => r.type === 'INCOME')).toBe(true);
    expect(rows.map((r: any) => r.counterparty)).toEqual(['Mario', 'Pippo']);
  });

  it('rifiuta un piano senza rate', async () => {
    const req: any = { userId: 'u1', body: { direction: 'DEBT', title: 'X', installments: [] } };
    const res = mockRes();
    await createInstallmentPlan(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(p.$transaction).not.toHaveBeenCalled();
  });

  it('rifiuta una rata con importo non valido', async () => {
    const req: any = {
      userId: 'u1',
      body: { direction: 'DEBT', title: 'X', installments: [{ amount: 0, plannedDate: '2026-07-30' }] },
    };
    const res = mockRes();
    await createInstallmentPlan(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('getInstallmentPlans — progresso', () => {
  it('calcola paidCount, residuo e prossima scadenza dalle rate', async () => {
    p.installmentPlan.findMany.mockResolvedValue([
      {
        id: 'plan1',
        direction: 'DEBT',
        installments: [
          { amount: 100, isPaid: true, plannedDate: new Date('2026-07-30') },
          { amount: 50, isPaid: false, plannedDate: new Date('2026-09-16') },
          { amount: 50, isPaid: false, plannedDate: new Date('2026-08-20') },
        ],
      },
    ]);
    const req: any = { userId: 'u1' };
    const res = mockRes();

    await getInstallmentPlans(req, res);

    const payload = res.json.mock.calls[0][0][0];
    expect(payload.progress.totalCount).toBe(3);
    expect(payload.progress.paidCount).toBe(1);
    expect(payload.progress.paidAmount).toBeCloseTo(100, 2);
    expect(payload.progress.remainingAmount).toBeCloseTo(100, 2);
    // prossima scadenza = la rata non pagata più vicina (20/8, non 16/9)
    expect(new Date(payload.progress.nextDueDate).getTime())
      .toBe(new Date('2026-08-20').getTime());
  });
});

describe('payInstallments — pagamento multiplo → 1 transazione', () => {
  it('somma le rate selezionate in UNA transazione, le marca pagate e completa il piano', async () => {
    p.plannedTransaction.findMany.mockResolvedValue([
      { id: 'r1', planId: 'plan1', type: 'EXPENSE', amount: 173.25, accountId: 'acc1', categoryId: null },
      { id: 'r2', planId: 'plan1', type: 'EXPENSE', amount: 173.94, accountId: 'acc1', categoryId: null },
    ]);
    p.installmentPlan.findFirst.mockResolvedValue({ id: 'plan1', title: 'F24 2026', accountId: 'acc1', categoryId: null });
    p.transaction.create.mockResolvedValue({ id: 'tx1' });
    p.plannedTransaction.count.mockResolvedValue(0); // nessuna rata residua → COMPLETED

    const req: any = { userId: 'u1', body: { plannedIds: ['r1', 'r2'] } };
    const res = mockRes();

    await payInstallments(req, res);

    // UNA sola transazione con l'importo sommato
    expect(p.transaction.create).toHaveBeenCalledTimes(1);
    const txData = p.transaction.create.mock.calls[0][0].data;
    expect(txData.amount).toBeCloseTo(347.19, 2);
    expect(txData.type).toBe('EXPENSE');
    // entrambe le rate marcate pagate
    expect(p.plannedTransaction.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['r1', 'r2'] } },
      data: { isPaid: true },
    });
    // piano completato
    expect(p.installmentPlan.update).toHaveBeenCalledWith({
      where: { id: 'plan1' },
      data: { status: 'COMPLETED' },
    });
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ count: 2 }));
  });

  it('rifiuta rate appartenenti a piani diversi', async () => {
    p.plannedTransaction.findMany.mockResolvedValue([
      { id: 'r1', planId: 'plan1', type: 'EXPENSE', amount: 10 },
      { id: 'r2', planId: 'plan2', type: 'EXPENSE', amount: 10 },
    ]);
    const req: any = { userId: 'u1', body: { plannedIds: ['r1', 'r2'] } };
    const res = mockRes();
    await payInstallments(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(p.transaction.create).not.toHaveBeenCalled();
  });

  it('rifiuta se qualche rata è già pagata o non trovata', async () => {
    p.plannedTransaction.findMany.mockResolvedValue([{ id: 'r1', planId: 'plan1', type: 'EXPENSE', amount: 10 }]);
    const req: any = { userId: 'u1', body: { plannedIds: ['r1', 'r2'] } };
    const res = mockRes();
    await payInstallments(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('deleteInstallmentPlan', () => {
  it('elimina le rate non pagate e poi il piano (le pagate si scollegano via DB)', async () => {
    p.installmentPlan.findFirst.mockResolvedValue({ id: 'plan1' });
    const req: any = { userId: 'u1', params: { id: 'plan1' } };
    const res = mockRes();

    await deleteInstallmentPlan(req, res);

    expect(p.plannedTransaction.deleteMany).toHaveBeenCalledWith({
      where: { planId: 'plan1', isPaid: false },
    });
    expect(p.installmentPlan.delete).toHaveBeenCalledWith({ where: { id: 'plan1' } });
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.any(String) }));
  });

  it('risponde 404 se il piano non esiste', async () => {
    p.installmentPlan.findFirst.mockResolvedValue(null);
    const req: any = { userId: 'u1', params: { id: 'nope' } };
    const res = mockRes();
    await deleteInstallmentPlan(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(p.installmentPlan.delete).not.toHaveBeenCalled();
  });
});
