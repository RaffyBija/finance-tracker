import { describe, it, expect, vi, beforeEach } from 'vitest';
import prisma from '../../utils/prisma';
import { verifyEmailChange } from '../../controllers/auth.controller';

vi.mock('resend', () => ({ Resend: function () { return { emails: { send: vi.fn() } }; } }));
vi.mock('../../utils/prisma', () => ({
  default: { user: { findFirst: vi.fn(), update: vi.fn() } },
}));
vi.mock('../../utils/analyticsCache', () => ({ analyticsCache: {} }));
vi.mock('../../utils/defaultCategories', () => ({ seedDefaultCategories: vi.fn() }));

const u: any = prisma.user;
const mockRes = () => { const r: any = {}; r.status = vi.fn().mockReturnValue(r); r.json = vi.fn().mockReturnValue(r); return r; };

beforeEach(() => vi.clearAllMocks());

describe('verifyEmailChange: il token deve essere una stringa', () => {
  it.each([
    [{ not: '' }],          // operatore Prisma: non deve diventare un filtro
    [{ contains: 'a' }],
    [['a']],
    [123],
    [true],
    [undefined],
    [''],
  ])('token %j → 400 e nessuna query', async (token) => {
    const res = mockRes();
    await verifyEmailChange({ body: { token } } as any, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(u.findFirst).not.toHaveBeenCalled();
    expect(u.update).not.toHaveBeenCalled();
  });

  it('un token stringa valido arriva alla query come stringa', async () => {
    u.findFirst.mockResolvedValue(null);
    const res = mockRes();
    await verifyEmailChange({ body: { token: 'abc123' } } as any, res);
    expect(u.findFirst.mock.calls[0][0].where.emailVerifyToken).toBe('abc123');
    expect(res.status).toHaveBeenCalledWith(400); // token non trovato
  });
});
