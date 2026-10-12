import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

vi.hoisted(() => { process.env.JWT_SECRET = 'test-secret'; });

import prisma from '../../utils/prisma';
import { authenticate } from '../../middleware/auth';
import { login, changePassword, resetPassword } from '../../controllers/auth.controller';

vi.mock('resend', () => ({ Resend: function () { return { emails: { send: vi.fn() } }; } }));
vi.mock('../../utils/prisma', () => ({
  default: { user: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn() } },
}));
vi.mock('../../utils/analyticsCache', () => ({ analyticsCache: {} }));
vi.mock('../../utils/defaultCategories', () => ({ seedDefaultCategories: vi.fn() }));

const u: any = prisma.user;
const SECRET = 'test-secret';
const mockRes = () => { const r: any = {}; r.status = vi.fn().mockReturnValue(r); r.json = vi.fn().mockReturnValue(r); return r; };
const sign = (payload: object, opts: jwt.SignOptions = { expiresIn: '1d' }) => jwt.sign(payload, SECRET, opts);
const run = async (token?: string) => {
  const req: any = { headers: token ? { authorization: `Bearer ${token}` } : {} };
  const res = mockRes();
  const next = vi.fn();
  await authenticate(req, res, next);
  return { req, res, next };
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('authenticate: revoca delle sessioni', () => {
  it('token con la versione corrente → passa e imposta userId e scadenza', async () => {
    u.findUnique.mockResolvedValue({ tokenVersion: 2 });
    const { req, next } = await run(sign({ userId: 'u1', email: 'a@b.it', tv: 2 }));
    expect(next).toHaveBeenCalledOnce();
    expect(req.userId).toBe('u1');
    expect(req.tokenExp).toBeGreaterThan(Date.now() / 1000);
    expect(u.findUnique).toHaveBeenCalledWith({ where: { id: 'u1' }, select: { tokenVersion: true } });
  });

  it('token con versione vecchia (password cambiata o reimpostata) → 401, niente next', async () => {
    u.findUnique.mockResolvedValue({ tokenVersion: 3 });
    const { res, next } = await run(sign({ userId: 'u1', email: 'a@b.it', tv: 2 }));
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('token emesso prima della funzione (senza tv) vale come versione 0', async () => {
    u.findUnique.mockResolvedValue({ tokenVersion: 0 });
    expect((await run(sign({ userId: 'u1', email: 'a@b.it' }))).next).toHaveBeenCalledOnce();
    u.findUnique.mockResolvedValue({ tokenVersion: 1 });
    const { res, next } = await run(sign({ userId: 'u1', email: 'a@b.it' }));
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('account cancellato → 401', async () => {
    u.findUnique.mockResolvedValue(null);
    const { res, next } = await run(sign({ userId: 'u1', email: 'a@b.it', tv: 0 }));
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('errore di DB → 500, NON 401 (il frontend farebbe il logout)', async () => {
    u.findUnique.mockRejectedValue(new Error('db giù'));
    const { res, next } = await run(sign({ userId: 'u1', email: 'a@b.it', tv: 0 }));
    expect(res.status).toHaveBeenCalledWith(500);
    expect(next).not.toHaveBeenCalled();
  });

  it('token mancante, scaduto, firmato male → 401 senza interrogare il DB', async () => {
    expect((await run()).res.status).toHaveBeenCalledWith(401);
    const expired = await run(sign({ userId: 'u1', email: 'a@b.it', tv: 0 }, { expiresIn: -10 }));
    expect(expired.res.json).toHaveBeenCalledWith({ error: 'Token scaduto' });
    const bad = await run(jwt.sign({ userId: 'u1', tv: 0 }, 'altro-segreto'));
    expect(bad.res.json).toHaveBeenCalledWith({ error: 'Token non valido' });
    expect(u.findUnique).not.toHaveBeenCalled();
  });
});

describe('emissione e invalidazione', () => {
  it('login: il token porta la versione delle sessioni dell\'utente', async () => {
    u.findUnique.mockResolvedValue({
      id: 'u1', email: 'a@b.it', name: 'N', password: bcrypt.hashSync('segreta123', 4),
      isEmailVerified: true, tokenVersion: 4,
    });
    const res = mockRes();
    await login({ body: { email: 'a@b.it', password: 'segreta123' } } as any, res);
    const payload: any = jwt.verify(res.json.mock.calls[0][0].token, SECRET);
    expect(payload.tv).toBe(4);
    expect(payload.userId).toBe('u1');
  });

  it('cambio password: incrementa la versione e riemette un token valido con la STESSA scadenza', async () => {
    u.findUnique.mockResolvedValue({ id: 'u1', email: 'a@b.it', password: bcrypt.hashSync('vecchia123', 4) });
    u.update.mockResolvedValue({ tokenVersion: 5 });
    const exp = Math.floor(Date.now() / 1000) + 5 * 86400;
    const res = mockRes();
    await changePassword(
      { userId: 'u1', tokenExp: exp, body: { currentPassword: 'vecchia123', newPassword: 'nuova12345', confirmPassword: 'nuova12345' } } as any,
      res,
    );
    expect(u.update.mock.calls[0][0].data.tokenVersion).toEqual({ increment: 1 });
    const body = res.json.mock.calls[0][0];
    const payload: any = jwt.verify(body.token, SECRET);
    expect(payload.tv).toBe(5);
    expect(Math.abs(payload.exp - exp)).toBeLessThanOrEqual(2);
  });

  describe('scadenza del token riemesso dal cambio password', () => {
    const reissue = async (tokenExp: number | undefined) => {
      u.findUnique.mockResolvedValue({ id: 'u1', email: 'a@b.it', password: bcrypt.hashSync('vecchia123', 4) });
      u.update.mockResolvedValue({ tokenVersion: 1 });
      const res = mockRes();
      await changePassword(
        { userId: 'u1', tokenExp, body: { currentPassword: 'vecchia123', newPassword: 'nuova12345', confirmPassword: 'nuova12345' } } as any,
        res,
      );
      const payload: any = jwt.verify(res.json.mock.calls[0][0].token, SECRET);
      return payload.exp - Math.floor(Date.now() / 1000);
    };

    it('senza scadenza nota → 1 giorno', async () => {
      expect(Math.abs((await reissue(undefined)) - 86400)).toBeLessThanOrEqual(2);
    });

    it('scadenza già passata o tra meno di 60 s → minimo 60 s (mai un token già scaduto)', async () => {
      const past = await reissue(Math.floor(Date.now() / 1000) - 1000);
      expect(past).toBeGreaterThanOrEqual(58);
      expect(past).toBeLessThanOrEqual(62);
      const soon = await reissue(Math.floor(Date.now() / 1000) + 5);
      expect(soon).toBeGreaterThanOrEqual(58);
      expect(soon).toBeLessThanOrEqual(62);
    });

    it('mai più lunga di quella del token di partenza (nessun allungamento della sessione)', async () => {
      const thirtyDays = Math.floor(Date.now() / 1000) + 30 * 86400;
      expect(await reissue(thirtyDays)).toBeLessThanOrEqual(30 * 86400);
    });
  });

  it('reset password: incrementa la versione (invalida le sessioni di un eventuale token rubato)', async () => {
    u.findFirst.mockResolvedValue({ id: 'u1' });
    u.update.mockResolvedValue({});
    const res = mockRes();
    await resetPassword({ body: { token: 'tok', newPassword: 'nuova12345' } } as any, res);
    expect(u.update.mock.calls[0][0].data.tokenVersion).toEqual({ increment: 1 });
    expect(u.update.mock.calls[0][0].data.passwordResetToken).toBeNull();
  });
});
