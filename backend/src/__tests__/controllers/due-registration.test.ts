import { describe, it, expect, vi, beforeEach } from 'vitest';
import prisma from '../../utils/prisma';
import { reconcileCcChanges } from '../../utils/billingCycle';
import { markAsPaid, deletePlannedTransaction, updatePlannedTransaction } from '../../controllers/planned.controller';
import { executeRecurring, executeRecurringNow } from '../../controllers/recurring.controller';

// Registrazione delle scadenze dal popup "Scadenze da registrare":
// pianificate (markAsPaid) e ricorrenti (executeRecurring) con data effettiva.
vi.mock('../../utils/prisma', () => {
  const client: any = {
    plannedTransaction: { findFirst: vi.fn(), updateMany: vi.fn(), findUniqueOrThrow: vi.fn(), update: vi.fn(), delete: vi.fn() },
    recurringTransaction: { findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    transaction: { create: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
    account: { findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn(), count: vi.fn().mockResolvedValue(0) },
    $transaction: vi.fn(),
  };
  return { default: client };
});

vi.mock('../../utils/billingCycle', () => ({
  reconcileCcChanges: vi.fn().mockResolvedValue(false),
  debtContribution: (type: string, amount: number) => (type === 'EXPENSE' ? amount : -amount),
}));

vi.mock('../../utils/analyticsCache', () => ({
  analyticsCache: { onPlannedMutated: vi.fn(), onPlannedPaid: vi.fn(), onRecurringExecuted: vi.fn() },
}));

const p: any = prisma;

function mockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

beforeEach(() => {
  vi.clearAllMocks();
  p.$transaction.mockImplementation(async (cb: any) => cb(p));
  p.transaction.create.mockImplementation(async ({ data }: any) => ({ id: 'tx1', ...data }));
  p.recurringTransaction.updateMany.mockResolvedValue({ count: 1 });
});

describe('markAsPaid', () => {
  const planned = {
    id: 'p1', userId: 'u1', amount: 30, type: 'EXPENSE', description: 'Bolletta',
    categoryId: 'c1', accountId: 'cc1', plannedDate: new Date('2026-09-10'), isPaid: false,
  };

  it('usa la data passata e riconcilia il ciclo CC del conto', async () => {
    p.plannedTransaction.findFirst.mockResolvedValue(planned);
    p.plannedTransaction.updateMany.mockResolvedValue({ count: 1 });
    p.plannedTransaction.findUniqueOrThrow.mockResolvedValue({ ...planned, isPaid: true });

    const res = mockRes();
    await markAsPaid({ userId: 'u1', params: { id: 'p1' }, body: { date: '2026-09-12' } } as any, res);

    const txData = p.transaction.create.mock.calls[0][0].data;
    expect(txData.date).toEqual(new Date('2026-09-12'));
    expect(p.plannedTransaction.updateMany).toHaveBeenCalledWith({
      where: { id: 'p1', isPaid: false },
      data: { isPaid: true },
    });
    expect(reconcileCcChanges).toHaveBeenCalledWith('u1', [
      { accountId: 'cc1', date: new Date('2026-09-12'), signed: 30 },
    ]);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('409 se la pianificata risulta già pagata (doppio pagamento concorrente)', async () => {
    p.plannedTransaction.findFirst.mockResolvedValue(planned);
    p.plannedTransaction.updateMany.mockResolvedValue({ count: 0 });

    const res = mockRes();
    await markAsPaid({ userId: 'u1', params: { id: 'p1' }, body: {} } as any, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(reconcileCcChanges).not.toHaveBeenCalled();
  });
});

describe('executeRecurring', () => {
  // Mensile al giorno 1, iniziata nel 2020: la scadenza dovuta è sempre il 1° del mese corrente.
  const recurring = {
    id: 'r1', userId: 'u1', amount: 10, type: 'EXPENSE', description: 'Netflix', categoryId: 'c1',
    accountId: 'acc1', frequency: 'MONTHLY', dayOfMonth: 1, startDate: new Date('2020-01-01'),
    endDate: null, isActive: true, lastExecutedDate: null,
  };

  it('data effettiva sulla transazione, scadenza prevista su lastExecutedDate', async () => {
    p.recurringTransaction.findMany.mockResolvedValue([recurring]);

    const res = mockRes();
    await executeRecurring({ userId: 'u1', body: { ids: ['r1'], dates: { r1: '2026-09-03' } } } as any, res);

    const txData = p.transaction.create.mock.calls[0][0].data;
    expect(txData.date).toEqual(new Date('2026-09-03'));
    const lastExecuted: Date = p.recurringTransaction.updateMany.mock.calls[0][0].data.lastExecutedDate;
    expect(lastExecuted.getDate()).toBe(1);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(reconcileCcChanges).toHaveBeenCalledTimes(1);
  });

  it('non duplica se la scadenza è già stata eseguita', async () => {
    const now = new Date();
    p.recurringTransaction.findMany.mockResolvedValue([
      { ...recurring, lastExecutedDate: new Date(now.getFullYear(), now.getMonth(), 1) },
    ]);
    const res = mockRes();
    await executeRecurring({ userId: 'u1', body: { ids: ['r1'] } } as any, res);
    expect(p.transaction.create).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ created: [], count: 0 });
  });

  it('non duplica se una richiesta concorrente ha già preso la scadenza', async () => {
    p.recurringTransaction.findMany.mockResolvedValue([recurring]);
    p.recurringTransaction.updateMany.mockResolvedValue({ count: 0 });
    const res = mockRes();
    await executeRecurring({ userId: 'u1', body: { ids: ['r1'] } } as any, res);
    expect(p.transaction.create).not.toHaveBeenCalled();
  });

  it('registra anche le occorrenze arretrate', async () => {
    const now = new Date();
    p.recurringTransaction.findMany.mockResolvedValue([
      { ...recurring, lastExecutedDate: new Date(now.getFullYear(), now.getMonth() - 3, 1) },
    ]);
    const res = mockRes();
    await executeRecurring({ userId: 'u1', body: { ids: ['r1'] } } as any, res);
    expect(p.transaction.create).toHaveBeenCalledTimes(3); // 2 arretrate + corrente
  });

  it('400 se una data non è valida', async () => {
    const res = mockRes();
    await executeRecurring({ userId: 'u1', body: { ids: ['r1'], dates: { r1: 'boh' } } } as any, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(p.transaction.create).not.toHaveBeenCalled();
  });
});

describe('/planned/:id sulle rate di un piano (guard planId)', () => {
  const rata = { id: 'r1', userId: 'u1', planId: 'plan1', amount: 50, type: 'EXPENSE', plannedDate: new Date(), isPaid: false };

  it.each([
    ['markAsPaid', markAsPaid, {}],
    ['delete', deletePlannedTransaction, {}],
    ['update', updatePlannedTransaction, { amount: 99 }],
  ])('%s → 400 senza toccare il DB', async (_name, handler: any, body) => {
    p.plannedTransaction.findFirst.mockResolvedValue(rata);
    const res = mockRes();
    await handler({ userId: 'u1', params: { id: 'r1' }, body } as any, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(p.transaction.create).not.toHaveBeenCalled();
    expect(p.plannedTransaction.update).not.toHaveBeenCalled();
    expect(p.plannedTransaction.delete).not.toHaveBeenCalled();
  });
});

describe('executeRecurringNow', () => {
  const base = {
    id: 'r1', userId: 'u1', amount: 20, type: 'EXPENSE', description: 'Abbonamento', categoryId: 'c1',
    accountId: null, frequency: 'MONTHLY', dayOfMonth: 4, startDate: new Date(2026, 2, 4), endDate: null,
  };
  const run = async (lastExecutedDate: Date) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 5, 9, 0)); // 5 ottobre
    p.recurringTransaction.findFirst.mockResolvedValue({ ...base, lastExecutedDate });
    await executeRecurringNow({ userId: 'u1', params: { id: 'r1' } } as any, mockRes());
    vi.useRealTimers();
    return p.recurringTransaction.updateMany.mock.calls[0][0].data.lastExecutedDate;
  };

  it('scadenza del 4 non registrata: salda quella, non salta al 4 novembre', async () => {
    expect(await run(new Date(2026, 8, 4))).toEqual(new Date(2026, 9, 4));
  });

  it('scadenza corrente già registrata: esecuzione anticipata, segna la prossima futura', async () => {
    expect(await run(new Date(2026, 9, 4))).toEqual(new Date(2026, 10, 4));
  });
});

// Importo variabile (es. stipendio): mai registrato alla stima senza conferma,
// e dopo la registrazione la stima segue la mediana degli ultimi importi.
describe('ricorrente a importo variabile', () => {
  const salary = {
    id: 's1', userId: 'u1', amount: 1700, type: 'INCOME', description: 'Stipendio', categoryId: 'c1',
    accountId: 'acc1', frequency: 'MONTHLY', dayOfMonth: 1, startDate: new Date('2020-01-01'),
    endDate: null, isActive: true, lastExecutedDate: null, isVariableAmount: true,
  };

  it('execute senza importo confermato → 400, nessun movimento', async () => {
    p.recurringTransaction.findMany.mockResolvedValue([salary]);
    const res = mockRes();
    await executeRecurring({ userId: 'u1', body: { ids: ['s1'] } } as any, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(p.transaction.create).not.toHaveBeenCalled();
    expect(p.recurringTransaction.updateMany).not.toHaveBeenCalled();
  });

  it('execute-now senza importo confermato → 400, nessun movimento', async () => {
    p.recurringTransaction.findFirst.mockResolvedValue(salary);
    const res = mockRes();
    await executeRecurringNow({ userId: 'u1', params: { id: 's1' }, body: {} } as any, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(p.transaction.create).not.toHaveBeenCalled();
  });

  it('importo non valido → 400', async () => {
    const res = mockRes();
    await executeRecurring({ userId: 'u1', body: { ids: ['s1'], amounts: { s1: -5 } } } as any, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(p.transaction.create).not.toHaveBeenCalled();
  });

  // Movimenti di registrazioni distinte (createdAt lontani), dal più recente.
  const history = (amounts: number[]) => amounts.map((amount, i) => ({
    amount, date: new Date(2026, 9 - i, 1), createdAt: new Date(2026, 9 - i, 1, 9),
  }));

  it('registra l\'importo confermato e aggiorna la stima alla mediana degli ultimi 3', async () => {
    p.recurringTransaction.findMany.mockResolvedValue([salary]);
    p.transaction.findMany.mockResolvedValue(history([1760, 1650, 1720, 9999]));
    const res = mockRes();
    await executeRecurring({ userId: 'u1', body: { ids: ['s1'], amounts: { s1: 1760 } } } as any, res);

    expect(Number(p.transaction.create.mock.calls[0][0].data.amount)).toBe(1760);
    expect(p.transaction.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { fromRecurringId: 's1' },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      take: expect.any(Number),
    }));
    expect(p.transaction.findMany.mock.calls[0][0].take).toBeGreaterThan(3);
    expect(p.recurringTransaction.update).toHaveBeenCalledWith({ where: { id: 's1' }, data: { amount: 1720 } });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('con 2 arretrati: 3 movimenti [stima, stima, confermato] e la stima segue il confermato', async () => {
    const now = new Date();
    p.recurringTransaction.findMany.mockResolvedValue([
      { ...salary, lastExecutedDate: new Date(now.getFullYear(), now.getMonth() - 3, 1) },
    ]);
    // Come li rilegge il DB: arretrati alla stima + confermato creati nella stessa registrazione.
    const run = new Date(2026, 9, 2, 10);
    const at = (ms: number) => new Date(run.getTime() + ms);
    p.transaction.findMany.mockResolvedValue([
      { amount: 1900, date: new Date(2026, 9, 1), createdAt: at(6) },
      { amount: 1700, date: new Date(2026, 8, 1), createdAt: at(3) },
      { amount: 1700, date: new Date(2026, 7, 1), createdAt: at(0) },
    ]);
    const res = mockRes();
    await executeRecurring({ userId: 'u1', body: { ids: ['s1'], amounts: { s1: 1900 } } } as any, res);

    expect(p.transaction.create.mock.calls.map((c: any) => Number(c[0].data.amount))).toEqual([1700, 1700, 1900]);
    const estimate = p.recurringTransaction.update.mock.calls[0][0].data.amount;
    expect(estimate).not.toBe(1700);
    expect(estimate).toBe(1900);
  });

  it('execute-now con importo valido: movimento all\'importo confermato e stima aggiornata', async () => {
    p.recurringTransaction.findFirst.mockResolvedValue(salary);
    p.account.findFirst.mockResolvedValueOnce({ id: 'acc1' }); // conto dell'utente, non archiviato
    p.transaction.findMany.mockResolvedValue(history([1812.35, 1700.01]));
    const res = mockRes();
    await executeRecurringNow({ userId: 'u1', params: { id: 's1' }, body: { amount: 1812.345 } } as any, res);

    expect(Number(p.transaction.create.mock.calls[0][0].data.amount)).toBe(1812.35); // arrotondato al centesimo
    expect(p.recurringTransaction.update).toHaveBeenCalledWith({ where: { id: 's1' }, data: { amount: 1756.18 } });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('importo oltre il limite della colonna → 400', async () => {
    p.recurringTransaction.findFirst.mockResolvedValue(salary);
    const res = mockRes();
    await executeRecurringNow({ userId: 'u1', params: { id: 's1' }, body: { amount: 1e8 } } as any, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(p.transaction.create).not.toHaveBeenCalled();
  });

  it('importo che arrotondato sfora Decimal(10,2) → 400, nessuna registrazione', async () => {
    p.recurringTransaction.findMany.mockResolvedValue([salary]);
    const res = mockRes();
    await executeRecurring({ userId: 'u1', body: { ids: ['s1'], amounts: { s1: 99999999.995 } } } as any, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(p.transaction.create).not.toHaveBeenCalled();
    expect(p.recurringTransaction.updateMany).not.toHaveBeenCalled();
  });

  it('un importo non valido blocca tutte le ricorrenti della richiesta', async () => {
    p.recurringTransaction.findMany.mockResolvedValue([salary, { ...salary, id: 's2', isVariableAmount: false }]);
    const res = mockRes();
    await executeRecurring({ userId: 'u1', body: { ids: ['s1', 's2'], amounts: { s1: 1800, s2: 0 } } } as any, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(p.transaction.create).not.toHaveBeenCalled();
  });

  it('una ricorrente fissa non tocca la stima', async () => {
    p.recurringTransaction.findMany.mockResolvedValue([{ ...salary, isVariableAmount: false }]);
    const res = mockRes();
    await executeRecurring({ userId: 'u1', body: { ids: ['s1'] } } as any, res);
    expect(Number(p.transaction.create.mock.calls[0][0].data.amount)).toBe(1700);
    expect(p.recurringTransaction.update).not.toHaveBeenCalled();
  });

  it('amounts su una ricorrente fissa: registra l\'importo indicato, stima invariata', async () => {
    p.recurringTransaction.findMany.mockResolvedValue([{ ...salary, isVariableAmount: false }]);
    const res = mockRes();
    await executeRecurring({ userId: 'u1', body: { ids: ['s1'], amounts: { s1: 1650 } } } as any, res);
    expect(Number(p.transaction.create.mock.calls[0][0].data.amount)).toBe(1650);
    expect(p.recurringTransaction.update).not.toHaveBeenCalled();
  });

  it('errore nell\'aggiornare la stima: niente 500, i movimenti restano registrati', async () => {
    p.recurringTransaction.findMany.mockResolvedValue([salary]);
    p.transaction.findMany.mockRejectedValueOnce(new Error('db down'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = mockRes();
    await executeRecurring({ userId: 'u1', body: { ids: ['s1'], amounts: { s1: 1800 } } } as any, res);
    expect(res.status).toHaveBeenCalledWith(201);
    spy.mockRestore();
  });
});
