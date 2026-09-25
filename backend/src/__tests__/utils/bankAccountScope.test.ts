import { describe, it, expect, vi, beforeEach } from 'vitest';
import prisma from '../../utils/prisma';
import { bankAccountScope } from '../../utils/balance';

// Mock del singleton Prisma: solo il metodo toccato da bankAccountScope.
vi.mock('../../utils/prisma', () => ({
  default: {
    account: { findMany: vi.fn() },
  },
}));

const mockAccountFind = vi.mocked(prisma.account.findMany);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('bankAccountScope — esclusione CC dagli aggregati di liquidità', () => {
  it('nessun conto → nessun filtro (comportamento storico "tutte le transazioni")', async () => {
    mockAccountFind.mockResolvedValue([] as never);
    const scope = await bankAccountScope('u1');
    expect(scope).toEqual({});
  });

  it('solo conti BANK → filtro con tutti i loro id', async () => {
    mockAccountFind.mockResolvedValue([
      { id: 'bank1', type: 'BANK' },
      { id: 'bank2', type: 'BANK' },
    ] as never);
    const scope = await bankAccountScope('u1');
    expect(scope).toEqual({ accountId: { in: ['bank1', 'bank2'] } });
  });

  it('CC presenti → esclusa dal filtro, solo BANK restano', async () => {
    mockAccountFind.mockResolvedValue([
      { id: 'bank1', type: 'BANK' },
      { id: 'cc1', type: 'CREDIT_CARD' },
    ] as never);
    const scope = await bankAccountScope('u1');
    expect(scope).toEqual({ accountId: { in: ['bank1'] } });
  });

  it('solo CC, nessun conto BANK → filtro con lista vuota (nessuna transazione passa)', async () => {
    mockAccountFind.mockResolvedValue([{ id: 'cc1', type: 'CREDIT_CARD' }] as never);
    const scope = await bankAccountScope('u1');
    expect(scope).toEqual({ accountId: { in: [] } });
  });
});
