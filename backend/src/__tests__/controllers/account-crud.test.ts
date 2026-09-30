import { describe, it, expect, vi, beforeEach } from 'vitest';
import prisma from '../../utils/prisma';
import {
  createAccount, updateAccount, setDefaultAccount,
} from '../../controllers/account.controller';

// CRUD dei conti: validazione, limiti di piano, unicità del nome e — soprattutto —
// isolamento tra utenti (ogni lookup filtra per userId, accountId altrui rifiutati).
vi.mock('../../utils/prisma', () => {
  const client: any = {
    account: {
      findFirst: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn(),
    },
    user: { findUnique: vi.fn() },
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

function mockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

const created = (data: any) => ({ id: 'new', openingBalance: 0, creditLimit: null, ...data });

beforeEach(() => {
  vi.clearAllMocks();
  p.user.findUnique.mockResolvedValue({ isPro: false });
  p.account.count.mockResolvedValue(0);
  p.account.findFirst.mockResolvedValue(null);
  p.account.create.mockImplementation(async ({ data }: any) => created(data));
  p.account.update.mockImplementation(async ({ data }: any) => created(data));
  p.$transaction.mockResolvedValue([]);
});

describe('createAccount', () => {
  const req = (body: any) => ({ userId: 'u1', body } as any);

  it.each([
    ['nome vuoto', { name: '  ', type: 'BANK' }],
    ['tipo non valido', { name: 'X', type: 'SAVINGS' }],
    ['giorno di addebito 0', { name: 'X', type: 'CREDIT_CARD', billingDay: 0 }],
    ['giorno di addebito 32', { name: 'X', type: 'CREDIT_CARD', billingDay: 32 }],
    ['giorno di addebito non intero', { name: 'X', type: 'CREDIT_CARD', billingDay: 1.5 }],
  ])('400: %s', async (_n, body) => {
    const res = mockRes();
    await createAccount(req(body), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(p.account.create).not.toHaveBeenCalled();
  });

  it('403 al limite del piano, con upgrade=true per i non Pro', async () => {
    p.account.count.mockResolvedValue(999);
    const res = mockRes();
    await createAccount(req({ name: 'X', type: 'BANK' }), res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json.mock.calls[0][0].upgrade).toBe(true);
    expect(p.account.create).not.toHaveBeenCalled();
  });

  it('il limite conta solo i conti non archiviati', async () => {
    const res = mockRes();
    await createAccount(req({ name: 'X', type: 'BANK' }), res);
    expect(p.account.count).toHaveBeenCalledWith({ where: { userId: 'u1', archivedAt: null } });
  });

  it('409 se il nome esiste già (anche archiviato, con messaggio dedicato)', async () => {
    p.account.findFirst.mockResolvedValueOnce({ id: 'old', archivedAt: new Date() });
    const res = mockRes();
    await createAccount(req({ name: 'X', type: 'BANK' }), res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json.mock.calls[0][0].error).toMatch(/archiviato/);
  });

  it('400 se il conto collegato non è dell\'utente', async () => {
    p.account.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    const res = mockRes();
    await createAccount(req({ name: 'Visa', type: 'CREDIT_CARD', linkedAccountId: 'altrui' }), res);
    expect(p.account.findFirst).toHaveBeenLastCalledWith({ where: { id: 'altrui', userId: 'u1', archivedAt: null } });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(p.account.create).not.toHaveBeenCalled();
  });

  it('userId preso dal token e non dal body; nome trimmato', async () => {
    const res = mockRes();
    await createAccount(req({ name: ' Intesa ', type: 'BANK', userId: 'altro' }), res);
    const data = p.account.create.mock.calls[0][0].data;
    expect(data.userId).toBe('u1');
    expect(data.name).toBe('Intesa');
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('un BANK ignora i campi carta', async () => {
    p.account.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'x' });
    const res = mockRes();
    await createAccount(req({
      name: 'Intesa', type: 'BANK', creditLimit: 500, billingDay: 5, closingDay: 3, linkedAccountId: 'x',
    }), res);
    expect(p.account.create.mock.calls[0][0].data).toMatchObject({
      creditLimit: null, billingDay: null, closingDay: null, linkedAccountId: null,
    });
  });

  it('una CC salva limite, giorni e conto collegato', async () => {
    p.account.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'bank' });
    const res = mockRes();
    await createAccount(req({
      name: 'Visa', type: 'CREDIT_CARD', creditLimit: 1500, billingDay: '10', closingDay: '5', linkedAccountId: 'bank',
    }), res);
    expect(p.account.create.mock.calls[0][0].data).toMatchObject({
      creditLimit: 1500, billingDay: 10, closingDay: 5, linkedAccountId: 'bank',
    });
  });
});

describe('updateAccount', () => {
  const existing = { id: 'a1', userId: 'u1', name: 'Vecchio', archivedAt: null };
  const req = (body: any) => ({ userId: 'u1', params: { id: 'a1' }, body } as any);

  it('404 se il conto non è dell\'utente (lookup filtrato per userId)', async () => {
    const res = mockRes();
    await updateAccount(req({ name: 'X' }), res);
    expect(p.account.findFirst).toHaveBeenCalledWith({ where: { id: 'a1', userId: 'u1' } });
    expect(res.status).toHaveBeenCalledWith(404);
    expect(p.account.update).not.toHaveBeenCalled();
  });

  it('409 se il nuovo nome è già usato da un altro conto', async () => {
    p.account.findFirst.mockResolvedValueOnce(existing).mockResolvedValueOnce({ id: 'a2', archivedAt: null });
    const res = mockRes();
    await updateAccount(req({ name: 'Occupato' }), res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(p.account.update).not.toHaveBeenCalled();
  });

  it('400 con giorno di addebito non valido', async () => {
    p.account.findFirst.mockResolvedValueOnce(existing);
    const res = mockRes();
    await updateAccount(req({ billingDay: 40 }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('400 se il conto collegato non è dell\'utente', async () => {
    p.account.findFirst.mockResolvedValueOnce(existing).mockResolvedValueOnce(null);
    const res = mockRes();
    await updateAccount(req({ linkedAccountId: 'altrui' }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(p.account.update).not.toHaveBeenCalled();
  });

  it('openingBalance non è modificabile', async () => {
    p.account.findFirst.mockResolvedValueOnce(existing);
    const res = mockRes();
    await updateAccount(req({ color: '#fff', openingBalance: 99999 }), res);
    const data = p.account.update.mock.calls[0][0].data;
    expect(data).toEqual({ color: '#fff' });
  });
});

describe('setDefaultAccount', () => {
  const req = { userId: 'u1', params: { id: 'a1' } } as any;

  it('404 per conti altrui o archiviati', async () => {
    const res = mockRes();
    await setDefaultAccount(req, res);
    expect(p.account.findFirst).toHaveBeenCalledWith({ where: { id: 'a1', userId: 'u1', archivedAt: null } });
    expect(res.status).toHaveBeenCalledWith(404);
    expect(p.$transaction).not.toHaveBeenCalled();
  });

  it('azzera gli altri e imposta il nuovo in un\'unica transazione, solo sull\'utente', async () => {
    p.account.findFirst.mockResolvedValueOnce({ id: 'a1' });
    const res = mockRes();
    await setDefaultAccount(req, res);
    expect(p.$transaction).toHaveBeenCalledTimes(1);
    expect(p.account.updateMany).toHaveBeenCalledWith({ where: { userId: 'u1' }, data: { isDefault: false } });
    expect(p.account.update).toHaveBeenCalledWith({ where: { id: 'a1' }, data: { isDefault: true } });
  });
});
