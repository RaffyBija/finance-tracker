import { describe, it, expect, vi, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../../utils/prisma';
import {
  verifyEmail, resetPassword, login, changePassword, deleteAccount,
} from '../../controllers/auth.controller';

vi.mock('../../utils/prisma', () => ({
  default: {
    user: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
  },
}));
vi.mock('../../utils/email', () => ({
  sendVerificationEmail: vi.fn(), sendPasswordResetEmail: vi.fn(), sendEmailChangeVerification: vi.fn(),
}));
vi.mock('../../utils/analyticsCache', () => ({ analyticsCache: {} }));
vi.mock('../../utils/defaultCategories', () => ({ seedDefaultCategories: vi.fn() }));

const u: any = prisma.user;

function mockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.JWT_SECRET = 'test-secret';
});

// Regressione dell'account takeover: senza token Prisma ignora il filtro `undefined`
// e troverebbe il primo utente con un reset pendente.
describe('guard sul token (no account takeover)', () => {
  it.each([
    ['verifyEmail', verifyEmail, {}],
    ['verifyEmail (non stringa)', verifyEmail, { token: { $ne: null } }],
    ['resetPassword', resetPassword, { newPassword: 'nuovaPassword' }],
    ['resetPassword (non stringa)', resetPassword, { token: { not: '' }, newPassword: 'nuovaPassword' }],
  ])('%s: 400 senza toccare il DB', async (_n, handler: any, body) => {
    const res = mockRes();
    await handler({ body } as any, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(u.findFirst).not.toHaveBeenCalled();
    expect(u.update).not.toHaveBeenCalled();
  });
});

describe('resetPassword', () => {
  it('400 se la password è troppo corta', async () => {
    const res = mockRes();
    await resetPassword({ body: { token: 't', newPassword: '123' } } as any, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(u.findFirst).not.toHaveBeenCalled();
  });

  it('cerca solo token non scaduti; 400 se non trovato', async () => {
    u.findFirst.mockResolvedValue(null);
    const res = mockRes();
    await resetPassword({ body: { token: 't', newPassword: 'nuovaPassword' } } as any, res);
    expect(u.findFirst.mock.calls[0][0].where.passwordResetExpires).toEqual({ gte: expect.any(Date) });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(u.update).not.toHaveBeenCalled();
  });

  it('salva la password hashata e invalida il token', async () => {
    u.findFirst.mockResolvedValue({ id: 'u1' });
    const res = mockRes();
    await resetPassword({ body: { token: 't', newPassword: 'nuovaPassword' } } as any, res);
    const data = u.update.mock.calls[0][0].data;
    expect(data.password).not.toBe('nuovaPassword');
    expect(await bcrypt.compare('nuovaPassword', data.password)).toBe(true);
    expect(data.passwordResetToken).toBeNull();
    expect(data.passwordResetExpires).toBeNull();
  });
});

describe('verifyEmail', () => {
  it('400 con token sconosciuto', async () => {
    u.findFirst.mockResolvedValue(null);
    const res = mockRes();
    await verifyEmail({ body: { token: 'x' } } as any, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(u.update).not.toHaveBeenCalled();
  });

  it('verifica e consuma il token', async () => {
    u.findFirst.mockResolvedValue({ id: 'u1' });
    const res = mockRes();
    await verifyEmail({ body: { token: 'x' } } as any, res);
    expect(u.update.mock.calls[0][0].data).toMatchObject({
      isEmailVerified: true, emailVerifyToken: null, emailVerifyExpires: null,
    });
  });
});

describe('login', () => {
  let hash: string;
  beforeEach(async () => { hash = await bcrypt.hash('segreta123', 4); });
  const user = (over = {}) => ({
    id: 'u1', email: 'a@b.it', name: 'A', isPro: false, tourCompleted: true, currency: 'EUR',
    savingRate: 0, salaryCategoryId: null, payDay: null, isEmailVerified: true, ...over,
  });

  it('400 con campi vuoti', async () => {
    const res = mockRes();
    await login({ body: { email: ' ', password: '' } } as any, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('401 generico per utente inesistente (nessun user enumeration)', async () => {
    u.findUnique.mockResolvedValue(null);
    const res = mockRes();
    await login({ body: { email: 'a@b.it', password: 'x' } } as any, res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Credenziali non valide' });
  });

  it('401 se l\'email non è verificata, anche con password corretta', async () => {
    u.findUnique.mockResolvedValue(user({ password: hash, isEmailVerified: false }));
    const res = mockRes();
    await login({ body: { email: 'a@b.it', password: 'segreta123' } } as any, res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json.mock.calls[0][0].token).toBeUndefined();
  });

  it('401 con password errata', async () => {
    u.findUnique.mockResolvedValue(user({ password: hash }));
    const res = mockRes();
    await login({ body: { email: 'a@b.it', password: 'sbagliata' } } as any, res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Credenziali non valide' });
  });

  it.each([[true, 30 * 86400], [false, 86400]])('JWT valido (rememberMe=%s → %ss) e senza password nella risposta', async (rememberMe, ttl) => {
    u.findUnique.mockResolvedValue(user({ password: hash }));
    const res = mockRes();
    await login({ body: { email: 'a@b.it', password: 'segreta123', rememberMe } } as any, res);
    const body = res.json.mock.calls[0][0];
    const payload: any = jwt.verify(body.token, 'test-secret');
    expect(payload.userId).toBe('u1');
    expect(payload.exp - payload.iat).toBe(ttl);
    expect(JSON.stringify(body)).not.toContain(hash);
  });
});

describe('changePassword', () => {
  const body = (over = {}) => ({
    currentPassword: 'vecchiaPass1', newPassword: 'nuovaPass123', confirmPassword: 'nuovaPass123', ...over,
  });
  const req = (b: any) => ({ userId: 'u1', body: b } as any);

  it.each([
    ['campi mancanti', { currentPassword: '' }],
    ['conferma diversa', { confirmPassword: 'altro' }],
    ['troppo corta', { newPassword: 'corta', confirmPassword: 'corta' }],
    ['uguale alla attuale', { newPassword: 'vecchiaPass1', confirmPassword: 'vecchiaPass1' }],
  ])('400: %s', async (_n, over) => {
    const res = mockRes();
    await changePassword(req(body(over)), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(u.update).not.toHaveBeenCalled();
  });

  it('401 se la password attuale è errata', async () => {
    u.findUnique.mockResolvedValue({ id: 'u1', password: await bcrypt.hash('altra', 4) });
    const res = mockRes();
    await changePassword(req(body()), res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(u.update).not.toHaveBeenCalled();
  });

  it('aggiorna con hash quando la attuale è corretta', async () => {
    u.findUnique.mockResolvedValue({ id: 'u1', password: await bcrypt.hash('vecchiaPass1', 4) });
    const res = mockRes();
    await changePassword(req(body()), res);
    const pwd = u.update.mock.calls[0][0].data.password;
    expect(await bcrypt.compare('nuovaPass123', pwd)).toBe(true);
  });
});

describe('deleteAccount', () => {
  it('400 se l\'email di conferma non coincide: nessuna cancellazione', async () => {
    u.findUnique.mockResolvedValue({ id: 'u1', email: 'a@b.it' });
    const res = mockRes();
    await deleteAccount({ userId: 'u1', body: { confirmEmail: 'altra@b.it' } } as any, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(u.delete).not.toHaveBeenCalled();
  });

  it('cancella solo l\'utente autenticato (confronto case-insensitive)', async () => {
    u.findUnique.mockResolvedValue({ id: 'u1', email: 'A@B.it' });
    const res = mockRes();
    await deleteAccount({ userId: 'u1', body: { confirmEmail: ' a@b.IT ' } } as any, res);
    expect(u.delete).toHaveBeenCalledWith({ where: { id: 'u1' } });
  });
});
