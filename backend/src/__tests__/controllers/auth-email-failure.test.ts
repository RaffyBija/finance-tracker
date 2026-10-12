import { describe, it, expect, vi, beforeEach } from 'vitest';
import prisma from '../../utils/prisma';
import { register, requestPasswordReset, updateProfile } from '../../controllers/auth.controller';
import {
  sendVerificationEmail, sendPasswordResetEmail, sendEmailChangeVerification,
} from '../../utils/email';

// Resend NON lancia: restituisce { data, error }. Qui verifichiamo sia l'helper
// (error -> eccezione) sia come i controller reagiscono quando l'invio fallisce.
const { sendMock } = vi.hoisted(() => ({ sendMock: vi.fn() }));
vi.mock('resend', () => ({
  Resend: function () { return { emails: { send: sendMock } }; },
}));
vi.mock('../../utils/prisma', () => ({
  default: {
    user: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn(), create: vi.fn() },
    account: { create: vi.fn() },
  },
}));
vi.mock('../../utils/email', async (orig) => {
  const real: any = await orig();
  return {
    ...real,
    sendVerificationEmail: vi.fn(real.sendVerificationEmail),
    sendPasswordResetEmail: vi.fn(real.sendPasswordResetEmail),
    sendEmailChangeVerification: vi.fn(real.sendEmailChangeVerification),
  };
});
vi.mock('../../utils/analyticsCache', () => ({ analyticsCache: {} }));
vi.mock('../../utils/defaultCategories', () => ({ seedDefaultCategories: vi.fn() }));

const u: any = prisma.user;
const EMAIL_ERR = "Impossibile inviare l'email, riprova più tardi";

function mockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

beforeEach(() => {
  vi.clearAllMocks();
  sendMock.mockResolvedValue({
    data: null,
    error: { name: 'validation_error', message: 'Domain not verified for mario@esempio.it' },
  });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('helper email', () => {
  it.each([
    ['sendVerificationEmail', sendVerificationEmail],
    ['sendPasswordResetEmail', sendPasswordResetEmail],
    ['sendEmailChangeVerification', sendEmailChangeVerification],
  ])('%s lancia se Resend risponde con error, senza token né email nel messaggio', async (_n, fn: any) => {
    const err = await fn('mario@esempio.it', 'TOKENSEGRETO').catch((e: Error) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toContain('validation_error');
    expect(err.message).not.toContain('TOKENSEGRETO');
    expect(err.message).not.toContain('mario@esempio.it');
  });

  it('non lancia se Resend risponde senza error', async () => {
    sendMock.mockResolvedValue({ data: { id: 'x' }, error: null });
    await expect(sendVerificationEmail('a@b.it', 't')).resolves.toBeUndefined();
  });
});

describe('register con invio fallito', () => {
  it('502, nessun utente creato (si può riprovare)', async () => {
    u.findUnique.mockResolvedValue(null);
    const res = mockRes();
    await register({ body: { email: 'a@b.it', password: 'segreta123', name: 'A' } } as any, res);
    expect(res.status).toHaveBeenCalledWith(502);
    expect(res.json).toHaveBeenCalledWith({ error: EMAIL_ERR });
    expect(u.create).not.toHaveBeenCalled();
  });
});

describe('requestPasswordReset con invio fallito', () => {
  it('risposta identica a quella senza account, nessun errore al client', async () => {
    u.findUnique.mockResolvedValueOnce(null);
    const noAccount = mockRes();
    await requestPasswordReset({ body: { email: 'x@y.it' } } as any, noAccount);

    u.findUnique.mockResolvedValueOnce({ id: 'u1' });
    u.update.mockResolvedValue({});
    const withAccount = mockRes();
    await requestPasswordReset({ body: { email: 'a@b.it' } } as any, withAccount);

    expect(withAccount.status).not.toHaveBeenCalled();
    expect(withAccount.json.mock.calls[0]).toEqual(noAccount.json.mock.calls[0]);
    expect(console.error).toHaveBeenCalled();
  });
});

describe('updateProfile (cambio email) con invio fallito', () => {
  it('502 e profilo invariato: nessun pendingEmail/token salvato', async () => {
    u.findUnique.mockResolvedValue({ id: 'u1', email: 'vecchia@b.it' });
    u.findFirst.mockResolvedValue(null);
    const res = mockRes();
    await updateProfile({ userId: 'u1', body: { email: 'nuova@b.it', name: 'Nome' } } as any, res);
    expect(res.status).toHaveBeenCalledWith(502);
    expect(res.json).toHaveBeenCalledWith({ error: EMAIL_ERR });
    expect(u.update).not.toHaveBeenCalled();
  });
});
