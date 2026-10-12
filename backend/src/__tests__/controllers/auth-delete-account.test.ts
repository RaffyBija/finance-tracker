import { describe, it, expect, vi, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';
import prisma from '../../utils/prisma';
import { deleteAccount } from '../../controllers/auth.controller';

vi.mock('resend', () => ({ Resend: function () { return { emails: { send: vi.fn() } }; } }));
vi.mock('../../utils/prisma', () => ({
  default: { user: { findUnique: vi.fn(), delete: vi.fn() } },
}));
vi.mock('../../utils/analyticsCache', () => ({ analyticsCache: {} }));
vi.mock('../../utils/defaultCategories', () => ({ seedDefaultCategories: vi.fn() }));

const u: any = prisma.user;
const mockRes = () => { const r: any = {}; r.status = vi.fn().mockReturnValue(r); r.json = vi.fn().mockReturnValue(r); return r; };
const call = async (body: any) => {
  const res = mockRes();
  await deleteAccount({ userId: 'u1', body } as any, res);
  return res;
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  u.findUnique.mockResolvedValue({ id: 'u1', email: 'Mario@Esempio.it', password: bcrypt.hashSync('segreta123', 4) });
});

describe('deleteAccount: serve email E password', () => {
  it('con la sola email (token rubato) → 400 e nessuna cancellazione', async () => {
    const res = await call({ confirmEmail: 'mario@esempio.it' });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(u.delete).not.toHaveBeenCalled();
  });

  it.each([[123], [{ not: '' }], [['x']], [true]])('password non stringa %j → 400', async (pw) => {
    const res = await call({ confirmEmail: 'mario@esempio.it', currentPassword: pw });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(u.delete).not.toHaveBeenCalled();
  });

  it('email non stringa → 400 (non 500)', async () => {
    const res = await call({ confirmEmail: 42, currentPassword: 'segreta123' });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(u.delete).not.toHaveBeenCalled();
  });

  it('email sbagliata → 400', async () => {
    const res = await call({ confirmEmail: 'altro@esempio.it', currentPassword: 'segreta123' });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(u.delete).not.toHaveBeenCalled();
  });

  it('password errata → 401 (conteggiato dal limiter) e nessuna cancellazione', async () => {
    const res = await call({ confirmEmail: 'mario@esempio.it', currentPassword: 'sbagliata' });
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Password non corretta', code: 'WRONG_PASSWORD' });
    expect(u.delete).not.toHaveBeenCalled();
  });

  it('email (maiuscole/spazi ignorati) e password corrette → account cancellato', async () => {
    const res = await call({ confirmEmail: '  MARIO@esempio.IT ', currentPassword: 'segreta123' });
    expect(u.delete).toHaveBeenCalledWith({ where: { id: 'u1' } });
    expect(res.json).toHaveBeenCalledWith({ message: 'Account eliminato con successo' });
  });
});
