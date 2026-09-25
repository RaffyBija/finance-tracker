import { describe, it, expect, vi, beforeEach } from 'vitest';
import prisma from '../../utils/prisma';
import { getTransactions } from '../../controllers/transaction.controller';

// Mock del singleton Prisma: solo i metodi toccati da getTransactions.
vi.mock('../../utils/prisma', () => ({
  default: {
    transaction: { findMany: vi.fn() },
  },
}));

const mockTxFindMany = vi.mocked(prisma.transaction.findMany);

function mockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockTxFindMany.mockResolvedValue([] as never);
});

describe('getTransactions - ordinamento', () => {
  it('ordina per date desc con createdAt desc come tie-break deterministico', async () => {
    const req: any = { userId: 'u1', query: {} };
    const res = mockRes();

    await getTransactions(req, res);

    expect(mockTxFindMany).toHaveBeenCalledOnce();
    const callArgs = mockTxFindMany.mock.calls[0][0] as any;
    expect(callArgs.orderBy).toEqual([{ date: 'desc' }, { createdAt: 'desc' }]);
  });
});
