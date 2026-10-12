import { describe, it, expect, vi, beforeEach } from 'vitest';
import prisma from '../../utils/prisma';
import { requestPasswordReset } from '../../controllers/auth.controller';
import { sendPasswordResetEmail } from '../../utils/email';

vi.mock('resend', () => ({ Resend: function () { return { emails: { send: vi.fn() } }; } }));
vi.mock('../../utils/prisma', () => ({
  default: { user: { findFirst: vi.fn(), update: vi.fn() } },
}));
vi.mock('../../utils/email', async (orig) => {
  const real: any = await orig();
  return { ...real, sendPasswordResetEmail: vi.fn() };
});
vi.mock('../../utils/analyticsCache', () => ({ analyticsCache: {} }));
vi.mock('../../utils/defaultCategories', () => ({ seedDefaultCategories: vi.fn() }));

const u: any = prisma.user;
const send: any = sendPasswordResetEmail;
const mockRes = () => { const r: any = {}; r.status = vi.fn().mockReturnValue(r); r.json = vi.fn().mockReturnValue(r); return r; };
const GENERIC = { message: "Se l'email esiste, riceverai un link per il reset" };

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('requestPasswordReset: risposta subito, lavoro dopo', () => {
  it('risponde PRIMA di leggere il DB e di inviare la mail (tempi uguali con e senza account)', async () => {
    const order: string[] = [];
    const res = mockRes();
    res.json = vi.fn(() => { order.push('risposta'); return res; });
    u.findFirst.mockImplementation(async () => { order.push('lettura'); return { id: 'u1' }; });
    u.update.mockImplementation(async () => { order.push('token'); });
    send.mockImplementation(async () => { order.push('invio'); });

    await requestPasswordReset({ body: { email: 'mario@esempio.it' } } as any, res);

    expect(order).toEqual(['risposta', 'lettura', 'token', 'invio']);
    expect(res.json).toHaveBeenCalledWith(GENERIC);
  });

  it('stessa identica risposta senza account, e nessun token né mail', async () => {
    u.findFirst.mockResolvedValue(null);
    const res = mockRes();
    await requestPasswordReset({ body: { email: 'nessuno@esempio.it' } } as any, res);
    expect(res.json).toHaveBeenCalledWith(GENERIC);
    expect(u.update).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it("cerca l'account senza distinguere le maiuscole e invia all'indirizzo SALVATO", async () => {
    // register/login salvano l'email così com'è: un utente registrato come Mario@Esempio.it
    // deve poter fare il reset anche digitando mario@esempio.it (e viceversa).
    u.findFirst.mockResolvedValue({ id: 'u1', email: 'Mario@Esempio.it' });
    await requestPasswordReset({ body: { email: '  mario@esempio.IT ' } } as any, mockRes());
    expect(u.findFirst).toHaveBeenCalledWith({ where: { email: { equals: 'mario@esempio.IT', mode: 'insensitive' } } });
    expect(send.mock.calls[0][0]).toBe('Mario@Esempio.it');
  });

  it('senza body → 400 (non 500)', async () => {
    const res = mockRes();
    await requestPasswordReset({} as any, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("un errore di invio o di DB dopo la risposta viene solo loggato: nessun secondo invio di risposta", async () => {
    u.findFirst.mockResolvedValue({ id: 'u1' });
    u.update.mockResolvedValue({});
    send.mockRejectedValue(new Error('Invio email fallito'));
    const res = mockRes();
    await requestPasswordReset({ body: { email: 'mario@esempio.it' } } as any, res);
    expect(res.json).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();

    u.findFirst.mockRejectedValue(new Error('db giù'));
    const res2 = mockRes();
    await requestPasswordReset({ body: { email: 'mario@esempio.it' } } as any, res2);
    expect(res2.json).toHaveBeenCalledTimes(1);
    expect(res2.status).not.toHaveBeenCalled();
  });

  it.each([[undefined], [''], ['  '], [42], [{ not: '' }], [['a@x.it']]])('email %j → 400 e nessuna query', async (email) => {
    const res = mockRes();
    await requestPasswordReset({ body: { email } } as any, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(u.findFirst).not.toHaveBeenCalled();
  });
});
