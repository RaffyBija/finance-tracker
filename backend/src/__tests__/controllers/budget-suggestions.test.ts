import { describe, it, expect, vi, beforeEach } from 'vitest';
import { planWindow, applySaving } from '../../utils/budgetPlan';

// ── Mock del singleton Prisma (solo i metodi toccati dagli endpoint) ──
const {
  userFindUnique, accountFindMany, budgetFindMany, categoryFindMany, budgetUpdate, budgetCreate, txn, computeBudgetPlan,
} = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  accountFindMany: vi.fn(),
  budgetFindMany: vi.fn(),
  categoryFindMany: vi.fn(),
  budgetUpdate: vi.fn(),
  budgetCreate: vi.fn(),
  txn: vi.fn(),
  computeBudgetPlan: vi.fn(),
}));

vi.mock('../../utils/prisma', () => ({
  default: {
    user: { findUnique: userFindUnique },
    account: { findMany: accountFindMany },
    budget: { findMany: budgetFindMany, update: budgetUpdate, create: budgetCreate },
    category: { findMany: categoryFindMany },
    $transaction: txn,
  },
}));

// Il calcolo del piano è testato a parte (funzioni pure qui sotto): nel controller
// si verificano parametri, cache e risparmio.
vi.mock('../../utils/budgetPlan', async (orig) => ({
  ...(await orig<typeof import('../../utils/budgetPlan')>()),
  computeBudgetPlan,
}));

vi.mock('../../utils/analyticsCache', () => ({
  analyticsCache: {
    get: () => undefined,
    set: vi.fn(),
    delPattern: vi.fn(),
    keys: { budgetSuggestions: (u: string, suffix = '') => `budget-suggestions:${u}:${suffix}` },
  },
}));

import { getBudgetSuggestions, applyBudgetSuggestions } from '../../controllers/budget.controller';

const makeRes = () => {
  const res: any = {};
  res.json = vi.fn().mockReturnValue(res);
  res.status = vi.fn().mockReturnValue(res);
  return res;
};

beforeEach(() => {
  vi.clearAllMocks();
  userFindUnique.mockResolvedValue({ savingRate: 0.1 });
  accountFindMany.mockResolvedValue([]);
  computeBudgetPlan.mockResolvedValue({ disposable: 1000, expectedIncome: 1700, perCategory: [] });
});

describe('planWindow — disponibile del periodo (per competenza)', () => {
  it('periodo in corso: netto a inizio periodo ricostruito da oggi', () => {
    // Oggi netto 800; nel periodo: entrate 1700, fisse 300, variabili 200 già avvenute;
    // attesi ancora 100 di fisse. Netto a inizio = 800 − 1700 + 300 + 200 = −400.
    const p = planWindow({
      netNow: 800,
      actual: { income: 1700, fixed: 300, variable: 200 },
      expected: { income: 0, fixed: 100 },
      gap: null,
    });
    expect(p).toEqual({ netStart: -400, income: 1700, fixed: 400, disposable: 900 });
    // Il disponibile NON dipende da quando si guarda: speso variabile + resto.
    expect(p.disposable).toBe(800 + 200 - 100);
  });

  it('periodo successivo: netto di oggi + flussi fino all\'inizio − variabili stimate', () => {
    const p = planWindow({
      netNow: 500,
      actual: null,
      expected: { income: 1700, fixed: 350 },
      gap: { income: 0, fixed: 120, variable: 180 },
    });
    expect(p).toEqual({ netStart: 200, income: 1700, fixed: 350, disposable: 1550 });
  });
});

describe('applySaving — risparmio sulle entrate, mai oltre il disponibile', () => {
  it('quota delle entrate del periodo', () => {
    expect(applySaving(1000, 1700, 0.1)).toEqual({ savingTarget: 170, spendable: 830 });
  });
  it('entrate assenti: nessun risparmio', () => {
    expect(applySaving(600, 0, 0.2)).toEqual({ savingTarget: 0, spendable: 600 });
  });
  it('disponibile inferiore alla quota: risparmio limitato al disponibile', () => {
    expect(applySaving(100, 1700, 0.2)).toEqual({ savingTarget: 100, spendable: 0 });
  });
  it('disponibile negativo: nessun risparmio', () => {
    expect(applySaving(-50, 1700, 0.2)).toEqual({ savingTarget: 0, spendable: -50 });
  });
});

describe('getBudgetSuggestions — parametri e risparmio', () => {
  it('default: periodo di paga, periodo corrente, risparmio dal profilo', async () => {
    const res = makeRes();
    await getBudgetSuggestions({ userId: 'u1', query: {} } as any, res);
    expect(computeBudgetPlan).toHaveBeenCalledWith('u1', { mode: 'pay', offset: 0, accountIds: undefined });
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ savingRate: 0.1, savingTarget: 170, spendable: 830 }));
  });

  it('mese solare, periodo successivo e override dello slider', async () => {
    const res = makeRes();
    await getBudgetSuggestions({ userId: 'u1', query: { period: 'month', offset: '1', savingRate: '0.2' } } as any, res);
    expect(computeBudgetPlan).toHaveBeenCalledWith('u1', { mode: 'month', offset: 1, accountIds: undefined });
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ savingRate: 0.2, savingTarget: 340, spendable: 660 }));
  });

  it('accetta monthOffset per compatibilità e filtra i conti validi', async () => {
    accountFindMany.mockResolvedValue([{ id: 'poste' }]);
    const res = makeRes();
    await getBudgetSuggestions({ userId: 'u1', query: { monthOffset: '1', accountIds: 'poste,ghost' } } as any, res);
    expect(computeBudgetPlan).toHaveBeenCalledWith('u1', { mode: 'pay', offset: 1, accountIds: ['poste'] });
  });
});

describe('applyBudgetSuggestions — upsert per categoria', () => {
  beforeEach(() => {
    budgetUpdate.mockResolvedValue({});
    budgetCreate.mockResolvedValue({});
    txn.mockImplementation(async (ops: any[]) => ops);
  });

  it('aggiorna il budget esistente e crea quello mancante, col periodo delle proposte', async () => {
    categoryFindMany.mockResolvedValue([{ id: 'food', name: 'Spesa' }, { id: 'fun', name: 'Svago' }]);
    budgetFindMany.mockResolvedValue([{ id: 'bf', categoryId: 'food', period: 'MONTHLY' }]);
    const res = makeRes();
    await applyBudgetSuggestions({
      userId: 'u1',
      body: { period: 'PAY_PERIOD', items: [{ categoryId: 'food', amount: 85 }, { categoryId: 'fun', amount: 17 }] },
    } as any, res);

    expect(budgetUpdate).toHaveBeenCalledWith({ where: { id: 'bf' }, data: { amount: 85, period: 'PAY_PERIOD' } });
    expect(budgetCreate.mock.calls[0][0].data).toMatchObject({
      name: 'Svago', amount: 17, categoryId: 'fun', period: 'PAY_PERIOD', rollover: 'NONE', userId: 'u1',
    });
    // Il budget esistente passa da mensile a periodo di paga: segnalato al client.
    expect(res.json).toHaveBeenCalledWith({ applied: 2, periodChanged: ['food'] });
  });

  it('senza periodo crea budget mensili', async () => {
    categoryFindMany.mockResolvedValue([{ id: 'fun', name: 'Svago' }]);
    budgetFindMany.mockResolvedValue([]);
    const res = makeRes();
    await applyBudgetSuggestions({ userId: 'u1', body: { items: [{ categoryId: 'fun', amount: 20 }] } } as any, res);
    expect(budgetCreate.mock.calls[0][0].data.period).toBe('MONTHLY');
  });

  it('rifiuta importi non positivi', async () => {
    const res = makeRes();
    await applyBudgetSuggestions({ userId: 'u1', body: { items: [{ categoryId: 'food', amount: 0 }] } } as any, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('rifiuta items vuoto o assente', async () => {
    const res = makeRes();
    await applyBudgetSuggestions({ userId: 'u1', body: {} } as any, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('404 se una categoria non appartiene all\'utente', async () => {
    categoryFindMany.mockResolvedValue([]);
    const res = makeRes();
    await applyBudgetSuggestions({ userId: 'u1', body: { items: [{ categoryId: 'ghost', amount: 50 }] } } as any, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});
