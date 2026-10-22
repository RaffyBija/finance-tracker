import { describe, it, expect, vi, beforeEach } from 'vitest';
import prisma from '../../utils/prisma';
import { rollbackPlannedPayment } from '../../utils/plannedRollback';

vi.mock('../../utils/prisma', () => ({
  default: {
    plannedTransaction: { findMany: vi.fn(), updateMany: vi.fn() },
    installmentPlan: { updateMany: vi.fn() },
  },
}));

const mockFind = vi.mocked(prisma.plannedTransaction.findMany);
const mockUpdate = vi.mocked(prisma.plannedTransaction.updateMany);
const mockPlanUpdate = vi.mocked(prisma.installmentPlan.updateMany);

beforeEach(() => vi.clearAllMocks());

describe('rollbackPlannedPayment', () => {
  it('riapre tutte le rate pagate insieme e riattiva il piano', async () => {
    mockFind.mockResolvedValue([{ id: 'r1', planId: 'p1' }, { id: 'r2', planId: 'p1' }] as never);
    expect(await rollbackPlannedPayment('u1', { id: 't1', fromPlannedId: 'r1' })).toBe(true);
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: { in: ['r1', 'r2'] } },
      data: { isPaid: false, paidTransactionId: null },
    });
    expect(mockPlanUpdate).toHaveBeenCalledWith({
      where: { id: { in: ['p1'] }, userId: 'u1', status: 'COMPLETED' },
      data: { status: 'ACTIVE' },
    });
  });

  it('pianificata singola: nessun piano da toccare', async () => {
    mockFind.mockResolvedValue([{ id: 's1', planId: null }] as never);
    expect(await rollbackPlannedPayment('u1', { id: 't1', fromPlannedId: 's1' })).toBe(true);
    expect(mockPlanUpdate).not.toHaveBeenCalled();
  });

  it('pagamento precedente alla migration: fallback sulla prima scadenza', async () => {
    mockFind.mockResolvedValueOnce([] as never).mockResolvedValueOnce([{ id: 'old', planId: null }] as never);
    expect(await rollbackPlannedPayment('u1', { id: 't1', fromPlannedId: 'old' })).toBe(true);
    expect(mockFind).toHaveBeenLastCalledWith({
      where: { id: 'old', userId: 'u1', isPaid: true, paidTransactionId: null },
      select: { id: true, planId: true },
    });
  });

  it('transazione manuale: niente da riaprire', async () => {
    mockFind.mockResolvedValue([] as never);
    expect(await rollbackPlannedPayment('u1', { id: 't1', fromPlannedId: null })).toBe(false);
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
