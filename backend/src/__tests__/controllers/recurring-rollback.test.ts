import { describe, it, expect, vi, beforeEach } from 'vitest';
import prisma from '../../utils/prisma';
import { rollbackRecurringExecution } from '../../controllers/recurring.controller';

vi.mock('../../utils/prisma', () => ({
  default: {
    recurringTransaction: { findFirst: vi.fn(), updateMany: vi.fn() },
    transaction: { findFirst: vi.fn() },
  },
}));

const mockRecFind = vi.mocked(prisma.recurringTransaction.findFirst);
const mockRecUpdate = vi.mocked(prisma.recurringTransaction.updateMany);
const mockTxFind = vi.mocked(prisma.transaction.findFirst);

const monthly = {
  id: 'r1', frequency: 'MONTHLY', dayOfMonth: 5,
  startDate: new Date(2026, 0, 1), endDate: null,
  lastExecutedDate: new Date(2026, 9, 5),
};
const deleted = { fromRecurringId: 'r1', date: new Date(2026, 9, 5) };

beforeEach(() => {
  vi.clearAllMocks();
  mockRecUpdate.mockResolvedValue({ count: 1 } as never);
});

describe('rollbackRecurringExecution', () => {
  it('senza altre registrazioni riporta lastExecutedDate a null', async () => {
    mockRecFind.mockResolvedValue(monthly as never);
    mockTxFind.mockResolvedValue(null as never);
    await rollbackRecurringExecution('u1', deleted);
    expect(mockRecUpdate).toHaveBeenCalledWith({ where: { id: 'r1', lastExecutedDate: monthly.lastExecutedDate }, data: { lastExecutedDate: null } });
  });

  it('con una registrazione precedente torna alla sua occorrenza', async () => {
    mockRecFind.mockResolvedValue(monthly as never);
    mockTxFind.mockResolvedValue({ date: new Date(2026, 8, 5) } as never);
    await rollbackRecurringExecution('u1', deleted);
    expect(mockRecUpdate).toHaveBeenCalledWith({ where: { id: 'r1', lastExecutedDate: monthly.lastExecutedDate }, data: { lastExecutedDate: new Date(2026, 8, 5) } });
  });

  it('se la transazione eliminata non era l\'ultima non tocca nulla', async () => {
    mockRecFind.mockResolvedValue(monthly as never);
    mockTxFind.mockResolvedValue({ date: new Date(2026, 9, 20) } as never);
    await rollbackRecurringExecution('u1', deleted);
    expect(mockRecUpdate).not.toHaveBeenCalled();
  });

  it('occorrenza precedente non ricostruibile (prima dello start): non azzera', async () => {
    mockRecFind.mockResolvedValue(monthly as never);
    mockTxFind.mockResolvedValue({ date: new Date(2025, 5, 1) } as never);
    await rollbackRecurringExecution('u1', deleted);
    expect(mockRecUpdate).not.toHaveBeenCalled();
  });

  it('transazione non da ricorrente: niente query', async () => {
    await rollbackRecurringExecution('u1', { fromRecurringId: null, date: new Date() });
    expect(mockRecFind).not.toHaveBeenCalled();
  });
});
