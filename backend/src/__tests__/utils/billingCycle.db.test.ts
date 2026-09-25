import { describe, it, expect, vi, beforeEach } from 'vitest';
import prisma from '../../utils/prisma';
import { computeCycleDebt, reconcileCcChanges, closeConcludedCycles } from '../../utils/billingCycle';

// Mock del singleton Prisma: solo i metodi toccati da queste funzioni.
vi.mock('../../utils/prisma', () => ({
  default: {
    transaction: { groupBy: vi.fn(), create: vi.fn() },
    billingCycle: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn(), updateMany: vi.fn(), create: vi.fn() },
    plannedTransaction: {
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    account: { findMany: vi.fn() },
    category: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  },
}));

// Accessor tipizzati ai mock
const mockGroupBy = vi.mocked(prisma.transaction.groupBy);
const mockTxCreate = vi.mocked(prisma.transaction.create);
const mockCycleFind = vi.mocked(prisma.billingCycle.findUnique);
const mockCycleFindMany = vi.mocked(prisma.billingCycle.findMany);
const mockCycleUpdate = vi.mocked(prisma.billingCycle.update);
const mockCycleUpdateMany = vi.mocked(prisma.billingCycle.updateMany);
const mockPlannedFind = vi.mocked(prisma.plannedTransaction.findUnique);
const mockPlannedUpdate = vi.mocked(prisma.plannedTransaction.update);
const mockPlannedCreate = vi.mocked(prisma.plannedTransaction.create);
const mockAccountFind = vi.mocked(prisma.account.findMany);
const mockCategoryFind = vi.mocked(prisma.category.findFirst);

const CC = {
  id: 'cc1',
  name: 'Visa',
  closingDay: 15,
  billingDay: 5,
  linkedAccountId: 'bank1',
};

beforeEach(() => {
  vi.clearAllMocks();
  mockCycleUpdate.mockResolvedValue({} as never);
  mockCycleUpdateMany.mockResolvedValue({ count: 1 } as never);
  mockPlannedUpdate.mockResolvedValue({} as never);
  mockTxCreate.mockResolvedValue({} as never);
  // Categoria di sistema "Pagamento Carta" già presente (usata dal conguaglio).
  mockCategoryFind.mockResolvedValue({ id: 'settlement', isSystem: true } as never);
});

describe('computeCycleDebt — debito = Σexpense − Σincome nella finestra', () => {
  const start = new Date(2026, 1, 16);
  const end = new Date(2026, 2, 15);

  it('sottrae le entrate (rimborsi) dalle uscite', async () => {
    mockGroupBy.mockResolvedValue([
      { type: 'EXPENSE', _sum: { amount: 100 } },
      { type: 'INCOME', _sum: { amount: 30 } },
    ] as never);
    expect(await computeCycleDebt('cc1', start, end)).toBe(70);
  });

  it('restituisce 0 quando non ci sono transazioni', async () => {
    mockGroupBy.mockResolvedValue([] as never);
    expect(await computeCycleDebt('cc1', start, end)).toBe(0);
  });

  it('con sole spese il debito è la somma delle uscite', async () => {
    mockGroupBy.mockResolvedValue([
      { type: 'EXPENSE', _sum: { amount: 250 } },
    ] as never);
    expect(await computeCycleDebt('cc1', start, end)).toBe(250);
  });

  it('interroga groupBy con la finestra e l’account corretti', async () => {
    mockGroupBy.mockResolvedValue([] as never);
    await computeCycleDebt('cc1', start, end);
    expect(mockGroupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ['type'],
        where: { accountId: 'cc1', date: { gte: start, lte: end } },
      }),
    );
  });
});

describe('reconcileCcChanges — riconciliazione cicli CC', () => {
  const now = new Date(2026, 2, 20);

  it('nessuna variazione su CC → ritorna false senza toccare il DB', async () => {
    const res = await reconcileCcChanges('u1', [
      { accountId: null, date: new Date(2026, 2, 10), signed: 50 },
    ], now);
    expect(res).toBe(false);
    expect(mockAccountFind).not.toHaveBeenCalled();
  });

  it('ciclo OPEN → nessuna azione, nessun conguaglio', async () => {
    mockAccountFind.mockResolvedValue([CC] as never);
    mockCycleFind.mockResolvedValue({ id: 'cyc1', status: 'OPEN' } as never);

    const res = await reconcileCcChanges('u1', [
      { accountId: 'cc1', date: new Date(2026, 2, 10), signed: 50 },
    ], now);

    expect(res).toBe(false);
    expect(mockTxCreate).not.toHaveBeenCalled();
  });

  it('ciclo CHIUSO già pagato → crea un conguaglio EXPENSE nel ciclo corrente', async () => {
    mockAccountFind.mockResolvedValue([CC] as never);
    mockCycleFind.mockResolvedValue({
      id: 'cyc1', status: 'CLOSED', plannedTransactionId: 'p1',
      periodEnd: new Date(2026, 2, 15),
    } as never);
    mockPlannedFind.mockResolvedValue({ id: 'p1', isPaid: true, amount: 200 } as never);

    const res = await reconcileCcChanges('u1', [
      { accountId: 'cc1', date: new Date(2026, 2, 10), signed: 40 },
    ], now);

    expect(mockTxCreate).toHaveBeenCalledTimes(1);
    expect(mockTxCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'EXPENSE', amount: 40, accountId: 'cc1', categoryId: 'settlement',
        }),
      }),
    );
    expect(res).toBe(false); // il ramo "pagato" non modifica pianificate
  });

  it('ciclo CHIUSO già pagato con delta negativo → conguaglio INCOME', async () => {
    mockAccountFind.mockResolvedValue([CC] as never);
    mockCycleFind.mockResolvedValue({
      id: 'cyc1', status: 'CLOSED', plannedTransactionId: 'p1',
      periodEnd: new Date(2026, 2, 15),
    } as never);
    mockPlannedFind.mockResolvedValue({ id: 'p1', isPaid: true, amount: 200 } as never);

    await reconcileCcChanges('u1', [
      { accountId: 'cc1', date: new Date(2026, 2, 10), signed: -25 },
    ], now);

    expect(mockTxCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: 'INCOME', amount: 25 }),
      }),
    );
  });

  it('ciclo CHIUSO non pagato → ricalcola il debito e aggiorna la pianificata', async () => {
    mockAccountFind.mockResolvedValue([CC] as never);
    mockCycleFind.mockResolvedValue({
      id: 'cyc1', userId: 'u1', accountId: 'cc1', status: 'CLOSED',
      plannedTransactionId: 'p1', periodEnd: new Date(2026, 2, 15),
      billingDate: new Date(2026, 3, 5),
    } as never);
    mockPlannedFind.mockResolvedValue({ id: 'p1', isPaid: false, amount: 100 } as never);
    mockGroupBy.mockResolvedValue([
      { type: 'EXPENSE', _sum: { amount: 120 } },
    ] as never);

    const res = await reconcileCcChanges('u1', [
      { accountId: 'cc1', date: new Date(2026, 2, 10), signed: 20 },
    ], now);

    expect(mockPlannedUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'p1' },
        data: { amount: 120 },
      }),
    );
    expect(res).toBe(true);
    expect(mockTxCreate).not.toHaveBeenCalled(); // niente conguaglio, solo ricalcolo
  });
});

describe('closeConcludedCycles — chiusura pigra auto-riparante', () => {
  // Oggi cade dopo la chiusura di giugno (Fine mese): il ciclo di giugno è concluso.
  const now = new Date(2026, 6, 6); // 6 luglio 2026

  const junCycle = {
    id: 'cyc-jun',
    userId: 'u1',
    accountId: 'cc1',
    periodStart: new Date(2026, 5, 1),
    periodEnd: new Date(2026, 5, 30, 23, 59, 59, 999),
    status: 'OPEN',
    plannedTransactionId: null,
    billingDate: null,
  };

  it('nessun ciclo concluso OPEN → ritorna 0 senza toccare i conti', async () => {
    mockCycleFindMany.mockResolvedValue([] as never);
    const res = await closeConcludedCycles('u1', now);
    expect(res).toBe(0);
    expect(mockAccountFind).not.toHaveBeenCalled();
    expect(mockCycleUpdateMany).not.toHaveBeenCalled();
  });

  it('ciclo concluso OPEN con debito → lo rivendica (lock) e crea la pianificata del pagamento', async () => {
    mockCycleFindMany.mockResolvedValue([junCycle] as never);
    mockAccountFind.mockResolvedValue([CC] as never);
    mockGroupBy.mockResolvedValue([{ type: 'EXPENSE', _sum: { amount: 386.21 } }] as never);
    mockPlannedCreate.mockResolvedValue({ id: 'p-jun' } as never);
    // ensureOpenCycle: il ciclo aperto corrente esiste già → short-circuit
    mockCycleFind.mockResolvedValue({ id: 'cyc-jul' } as never);

    const res = await closeConcludedCycles('u1', now);

    expect(res).toBe(1);
    // Lock ottimistico: chiude solo se ancora OPEN
    expect(mockCycleUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'cyc-jun', status: 'OPEN' },
        data: expect.objectContaining({ status: 'CLOSED' }),
      }),
    );
    expect(mockPlannedCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'EXPENSE',
          amount: 386.21,
          ccAccountId: 'cc1',
          accountId: 'bank1',
        }),
      }),
    );
  });

  it('ciclo già rivendicato da richiesta concorrente (count 0) → salta, niente pianificata', async () => {
    mockCycleFindMany.mockResolvedValue([junCycle] as never);
    mockAccountFind.mockResolvedValue([CC] as never);
    mockCycleUpdateMany.mockResolvedValue({ count: 0 } as never);

    const res = await closeConcludedCycles('u1', now);

    expect(res).toBe(0);
    expect(mockPlannedCreate).not.toHaveBeenCalled();
  });

  it('CC senza conto collegato → salta la chiusura (non può creare la pianificata)', async () => {
    mockCycleFindMany.mockResolvedValue([junCycle] as never);
    mockAccountFind.mockResolvedValue([{ ...CC, linkedAccountId: null }] as never);

    const res = await closeConcludedCycles('u1', now);

    expect(res).toBe(0);
    expect(mockCycleUpdateMany).not.toHaveBeenCalled();
    expect(mockPlannedCreate).not.toHaveBeenCalled();
  });
});
