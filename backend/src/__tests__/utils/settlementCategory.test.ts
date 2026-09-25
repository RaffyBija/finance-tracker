import { describe, it, expect, vi, beforeEach } from 'vitest';

const { findFirst, create, update } = vi.hoisted(() => ({
  findFirst: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
}));

vi.mock('../../utils/prisma', () => ({
  default: { category: { findFirst, create, update } },
}));

import { ensureSettlementCategory, SETTLEMENT_CATEGORY_NAME } from '../../utils/settlementCategory';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ensureSettlementCategory', () => {
  it('ritorna la categoria di sistema esistente senza crearla', async () => {
    findFirst.mockResolvedValue({ id: 'cat1', isSystem: true });

    const id = await ensureSettlementCategory('u1');

    expect(id).toBe('cat1');
    expect(create).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it('promuove a isSystem una categoria omonima preesistente non di sistema', async () => {
    findFirst.mockResolvedValue({ id: 'cat1', isSystem: false });

    const id = await ensureSettlementCategory('u1');

    expect(id).toBe('cat1');
    expect(update).toHaveBeenCalledWith({ where: { id: 'cat1' }, data: { isSystem: true } });
    expect(create).not.toHaveBeenCalled();
  });

  it('crea la categoria di sistema se non esiste', async () => {
    findFirst.mockResolvedValue(null);
    create.mockResolvedValue({ id: 'new1' });

    const id = await ensureSettlementCategory('u1');

    expect(id).toBe('new1');
    const data = create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      userId: 'u1',
      name: SETTLEMENT_CATEGORY_NAME,
      type: 'EXPENSE',
      isSystem: true,
    });
  });

  it('idempotente sotto corsa concorrente: su P2002 rilegge la categoria', async () => {
    findFirst
      .mockResolvedValueOnce(null) // prima lettura: non esiste
      .mockResolvedValueOnce({ id: 'race1' }); // dopo P2002: l'ha creata un altro
    create.mockRejectedValue({ code: 'P2002' });

    const id = await ensureSettlementCategory('u1');

    expect(id).toBe('race1');
  });
});
