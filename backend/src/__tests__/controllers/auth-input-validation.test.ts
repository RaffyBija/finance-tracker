import { describe, it, expect, vi, beforeEach } from 'vitest';
import prisma from '../../utils/prisma';
import { register, login, resetPassword, verifyEmail, changePassword } from '../../controllers/auth.controller';

vi.mock('resend', () => ({ Resend: function () { return { emails: { send: vi.fn() } }; } }));
vi.mock('../../utils/prisma', () => ({
  default: { user: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn(), create: vi.fn() } },
}));
vi.mock('../../utils/analyticsCache', () => ({ analyticsCache: {} }));
vi.mock('../../utils/defaultCategories', () => ({ seedDefaultCategories: vi.fn() }));

const u: any = prisma.user;
const mockRes = () => { const r: any = {}; r.status = vi.fn().mockReturnValue(r); r.json = vi.fn().mockReturnValue(r); return r; };

beforeEach(() => { vi.resetAllMocks(); vi.spyOn(console, 'error').mockImplementation(() => {}); });

describe('register e login: campi mancanti o non stringa → 400 (non 500)', () => {
  it.each([
    [{}], [undefined], [{ email: 'a@b.it', password: 'segreta1' }],
    [{ email: 5, password: 'x', name: 'N' }], [{ email: { not: '' }, password: 'x', name: 'N' }],
    [{ email: 'a@b.it', password: ['x'], name: 'N' }],
  ])('register con body %j', async (body) => {
    const res = mockRes();
    await register({ body } as any, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(u.findUnique).not.toHaveBeenCalled();
  });

  it.each([[{}], [undefined], [{ email: 'a@b.it' }], [{ email: 7, password: 'x' }], [{ email: 'a@b.it', password: { a: 1 } }]])(
    'login con body %j', async (body) => {
      const res = mockRes();
      await login({ body } as any, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(u.findUnique).not.toHaveBeenCalled();
    });
});

describe('resetPassword: newPassword deve essere una stringa', () => {
  it.each([[{ not: '' }], [123456], [['abcdefg']], [undefined]])('newPassword %j → 400', async (newPassword) => {
    const res = mockRes();
    await resetPassword({ body: { token: 'tok', newPassword } } as any, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(u.findFirst).not.toHaveBeenCalled();
  });
});

describe('verifyEmail: solo token di registrazione, mai quello di un cambio email', () => {
  it('la ricerca esclude gli utenti con un cambio email in sospeso e non impone scadenza', async () => {
    u.findFirst.mockResolvedValue(null);
    const res = mockRes();
    await verifyEmail({ body: { token: 'abc' } } as any, res);
    expect(u.findFirst).toHaveBeenCalledWith({ where: { emailVerifyToken: 'abc', pendingEmail: null } });
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('con token valido verifica l’email e azzera token e scadenza', async () => {
    u.findFirst.mockResolvedValue({ id: 'u1' });
    u.update.mockResolvedValue({});
    const res = mockRes();
    await verifyEmail({ body: { token: 'abc' } } as any, res);
    expect(u.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { isEmailVerified: true, emailVerifyToken: null, emailVerifyExpires: null },
    });
  });
});

describe('changePassword: campi non stringa → 400 (non 500)', () => {
  it.each([
    [{ currentPassword: { a: 1 }, newPassword: 'nuova1234', confirmPassword: 'nuova1234' }],
    [{ currentPassword: 'vecchia', newPassword: ['x', 'y'], confirmPassword: ['x', 'y'] }],
    [{ currentPassword: 'vecchia', newPassword: 123456789, confirmPassword: 123456789 }],
  ])('body %j', async (body) => {
    const res = mockRes();
    await changePassword({ userId: 'u1', body } as any, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(u.findUnique).not.toHaveBeenCalled();
  });
});
