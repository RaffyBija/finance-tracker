import { describe, it, expect, vi, beforeEach } from 'vitest';
import prisma from '../../utils/prisma';
import { createTransfer, updateTransfer, deleteTransfer } from '../../controllers/transaction.controller';

// Mock del singleton Prisma: solo i metodi toccati dai controller.
vi.mock('../../utils/prisma', () => ({
  default: {
    account: { findMany: vi.fn() },
    transaction: { create: vi.fn(), update: vi.fn(), deleteMany: vi.fn(), findMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

// Il cache analytics è un effetto collaterale non rilevante per questi test.
vi.mock('../../utils/analyticsCache', () => ({
  analyticsCache: {
    onTransactionMutated: vi.fn(),
    onPlannedMutated: vi.fn(),
  },
}));

const mockAccountFind = vi.mocked(prisma.account.findMany);
const mockTxCreate = vi.mocked(prisma.transaction.create);
const mockTxUpdate = vi.mocked(prisma.transaction.update);
const mockTxFindMany = vi.mocked(prisma.transaction.findMany);
const mockTxDeleteMany = vi.mocked(prisma.transaction.deleteMany);
const mockDollarTx = vi.mocked(prisma.$transaction);

// Stub minimale di Response.
function mockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

const BANK_A = { id: 'a', type: 'BANK' };
const BANK_B = { id: 'b', type: 'BANK' };
const CC = { id: 'c', type: 'CREDIT_CARD' };

beforeEach(() => {
  vi.clearAllMocks();
  mockTxCreate.mockReturnValue({} as never);
  mockTxUpdate.mockReturnValue({} as never);
  mockDollarTx.mockResolvedValue([{}, {}] as never);
});

describe('createTransfer', () => {
  it('crea due gambe collegate dallo stesso transferId (EXPENSE su origine, INCOME su destinazione)', async () => {
    mockAccountFind.mockResolvedValue([BANK_A, BANK_B] as never);
    const req: any = {
      userId: 'u1',
      body: { fromAccountId: 'a', toAccountId: 'b', amount: 250, date: '2026-06-18', description: 'Giroconto' },
    };
    const res = mockRes();

    await createTransfer(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(mockDollarTx).toHaveBeenCalledOnce();
    expect(mockTxCreate).toHaveBeenCalledTimes(2);

    const [first, second] = mockTxCreate.mock.calls.map((c: any) => c[0].data);
    // Stesso transferId sulle due gambe
    expect(first.transferId).toBeTruthy();
    expect(first.transferId).toBe(second.transferId);
    // Gamba uscita sull'origine, entrata sulla destinazione
    expect(first).toMatchObject({ type: 'EXPENSE', accountId: 'a', amount: 250 });
    expect(second).toMatchObject({ type: 'INCOME', accountId: 'b', amount: 250 });
  });

  it('rifiuta importo non valido (<= 0)', async () => {
    const req: any = { userId: 'u1', body: { fromAccountId: 'a', toAccountId: 'b', amount: 0 } };
    const res = mockRes();
    await createTransfer(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockDollarTx).not.toHaveBeenCalled();
  });

  it('rifiuta origine e destinazione coincidenti', async () => {
    const req: any = { userId: 'u1', body: { fromAccountId: 'a', toAccountId: 'a', amount: 50 } };
    const res = mockRes();
    await createTransfer(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockDollarTx).not.toHaveBeenCalled();
  });

  it('rifiuta se un conto non esiste / non appartiene all’utente', async () => {
    mockAccountFind.mockResolvedValue([BANK_A] as never); // solo uno trovato
    const req: any = { userId: 'u1', body: { fromAccountId: 'a', toAccountId: 'b', amount: 50 } };
    const res = mockRes();
    await createTransfer(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(mockDollarTx).not.toHaveBeenCalled();
  });

  it('rifiuta i trasferimenti che coinvolgono una carta di credito', async () => {
    mockAccountFind.mockResolvedValue([BANK_A, CC] as never);
    const req: any = { userId: 'u1', body: { fromAccountId: 'a', toAccountId: 'c', amount: 50 } };
    const res = mockRes();
    await createTransfer(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockDollarTx).not.toHaveBeenCalled();
  });
});

describe('updateTransfer', () => {
  const LEGS = [
    { id: 'leg-exp', type: 'EXPENSE' },
    { id: 'leg-inc', type: 'INCOME' },
  ];

  it('aggiorna entrambe le gambe per tipo (EXPENSE→origine, INCOME→destinazione)', async () => {
    mockTxFindMany.mockResolvedValue(LEGS as never);
    mockAccountFind.mockResolvedValue([BANK_A, BANK_B] as never);
    const req: any = {
      userId: 'u1',
      params: { transferId: 't1' },
      body: { fromAccountId: 'a', toAccountId: 'b', amount: 300, date: '2026-06-18', description: 'rettifica' },
    };
    const res = mockRes();

    await updateTransfer(req, res);

    expect(mockDollarTx).toHaveBeenCalledOnce();
    expect(mockTxUpdate).toHaveBeenCalledTimes(2);
    const calls = mockTxUpdate.mock.calls.map((c: any) => c[0]);
    const expUpdate = calls.find((c) => c.where.id === 'leg-exp');
    const incUpdate = calls.find((c) => c.where.id === 'leg-inc');
    expect(expUpdate.data).toMatchObject({ accountId: 'a', amount: 300 });
    expect(incUpdate.data).toMatchObject({ accountId: 'b', amount: 300 });
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ transferId: 't1' }));
  });

  it('risponde 404 se il trasferimento non esiste (gambe ≠ 2)', async () => {
    mockTxFindMany.mockResolvedValue([LEGS[0]] as never);
    const req: any = {
      userId: 'u1',
      params: { transferId: 'nope' },
      body: { fromAccountId: 'a', toAccountId: 'b', amount: 300 },
    };
    const res = mockRes();
    await updateTransfer(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(mockDollarTx).not.toHaveBeenCalled();
  });

  it('rifiuta la modifica verso una carta di credito', async () => {
    mockTxFindMany.mockResolvedValue(LEGS as never);
    mockAccountFind.mockResolvedValue([BANK_A, CC] as never);
    const req: any = {
      userId: 'u1',
      params: { transferId: 't1' },
      body: { fromAccountId: 'a', toAccountId: 'c', amount: 300 },
    };
    const res = mockRes();
    await updateTransfer(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockDollarTx).not.toHaveBeenCalled();
  });

  it('rifiuta origine e destinazione coincidenti', async () => {
    const req: any = {
      userId: 'u1',
      params: { transferId: 't1' },
      body: { fromAccountId: 'a', toAccountId: 'a', amount: 300 },
    };
    const res = mockRes();
    await updateTransfer(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockDollarTx).not.toHaveBeenCalled();
  });
});

describe('deleteTransfer', () => {
  it('rimuove entrambe le gambe e risponde con successo', async () => {
    mockTxDeleteMany.mockResolvedValue({ count: 2 } as never);
    const req: any = { userId: 'u1', params: { transferId: 't1' } };
    const res = mockRes();

    await deleteTransfer(req, res);

    expect(mockTxDeleteMany).toHaveBeenCalledWith({ where: { userId: 'u1', transferId: 't1' } });
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.any(String) }));
    expect(res.status).not.toHaveBeenCalledWith(404);
  });

  it('risponde 404 se nessuna gamba viene trovata', async () => {
    mockTxDeleteMany.mockResolvedValue({ count: 0 } as never);
    const req: any = { userId: 'u1', params: { transferId: 'nope' } };
    const res = mockRes();

    await deleteTransfer(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});
