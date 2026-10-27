import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { planWindow, applySaving, scaleCaps, planPace, isAlreadyPaidSalary } from '../../utils/budgetPlan';
import { median } from '../../utils/spendingRhythm';

// ── Mock del singleton Prisma (solo i metodi toccati dagli endpoint) ──
const {
  userFindUnique, accountFindMany, budgetFindMany, categoryFindMany, categoryFindFirst, budgetUpdate, budgetCreate, txn, computeBudgetPlan,
} = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  accountFindMany: vi.fn(),
  budgetFindMany: vi.fn(),
  categoryFindMany: vi.fn(),
  categoryFindFirst: vi.fn(),
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
    category: { findMany: categoryFindMany, findFirst: categoryFindFirst },
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

import { getBudgetSuggestions, applyBudgetSuggestions, createBudget } from '../../controllers/budget.controller';

const makeRes = () => {
  const res: any = {};
  res.json = vi.fn().mockReturnValue(res);
  res.status = vi.fn().mockReturnValue(res);
  return res;
};

const cap = (categoryId: string, suggestedCap: number) => ({
  categoryId, name: categoryId, icon: null, color: null, avgPerPeriod: suggestedCap, suggestedCap,
  currentBudgetId: null, currentAmount: null, currentPeriod: null, childBudgets: [],
});

beforeEach(() => {
  vi.clearAllMocks();
  // Nessun periodo di paga configurato: le finestre PAY_PERIOD ricadono sul mese.
  userFindUnique.mockResolvedValue({ savingRate: 0.1 });
  accountFindMany.mockResolvedValue([]);
  computeBudgetPlan.mockResolvedValue({
    disposable: 1000, expectedIncome: 1700, perCategory: [], offset: 0, variableSpent: 200,
    window: { start: '2026-10-23', end: '2026-11-22', label: '', days: 31, elapsedDays: 5 },
  });
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

describe('scaleCaps — tetti coerenti con lo spendibile (B5)', () => {
  it('sotto lo spendibile: invariati', () => {
    const r = scaleCaps([cap('a', 100), cap('b', 50)], 500);
    expect(r).toMatchObject({ capsScaled: false, scaleFactor: 1, capsTotal: 150 });
    expect(r.perCategory.map((c) => [c.rawCap, c.suggestedCap])).toEqual([[100, 100], [50, 50]]);
  });
  it('oltre lo spendibile: scala proporzionale, Σ mai sopra lo spendibile', () => {
    const r = scaleCaps([cap('a', 200), cap('b', 100.01)], 100);
    expect(r.capsScaled).toBe(true);
    expect(r.capsTotal).toBeLessThanOrEqual(100);
    expect(r.perCategory[0].rawCap).toBe(200);
    expect(r.perCategory[0].suggestedCap).toBeCloseTo(66.66, 2);
    expect(r.scaleFactor).toBeCloseTo(0.3333, 4);
  });
  it('spendibile <= 0: tetti a zero', () => {
    const r = scaleCaps([cap('a', 80)], -20);
    expect(r).toMatchObject({ capsScaled: true, scaleFactor: 0, capsTotal: 0 });
    expect(r.perCategory[0].suggestedCap).toBe(0);
  });
});

describe('planPace — ritmo del periodo (B7)', () => {
  const window = { start: '', end: '', label: '', days: 31, elapsedDays: 5 };
  it('periodo in corso: resto / giorni da oggi incluso', () => {
    expect(planPace({ offset: 0, variableSpent: 200, window }, 1000)).toEqual({ remaining: 800, daysLeft: 27, perDay: 29.63 });
  });
  it('periodo successivo: tutto lo spendibile sull\'intero periodo', () => {
    expect(planPace({ offset: 1, variableSpent: 0, window: { ...window, elapsedDays: 0 } }, 620)).toEqual({ remaining: 620, daysLeft: 31, perDay: 20 });
  });
  it('sforato: perDay mai negativo', () => {
    expect(planPace({ offset: 0, variableSpent: 1200, window }, 1000).perDay).toBe(0);
  });
});

describe('isAlreadyPaidSalary — de-dup stipendio (B6)', () => {
  const real = [new Date(2026, 9, 23)];
  it('ricorrente dello stesso stipendio già accreditato: scartata', () => {
    expect(isAlreadyPaidSalary(new Date(2026, 9, 23), 'sal', 'sal', real)).toBe(true);
    expect(isAlreadyPaidSalary(new Date(2026, 9, 27), 'sal', 'sal', real)).toBe(true);
  });
  it('stipendio del mese dopo, altra categoria o senza stipendio configurato: tenuto', () => {
    expect(isAlreadyPaidSalary(new Date(2026, 10, 23), 'sal', 'sal', real)).toBe(false);
    expect(isAlreadyPaidSalary(new Date(2026, 9, 23), 'bonus', 'sal', real)).toBe(false);
    expect(isAlreadyPaidSalary(new Date(2026, 9, 23), 'sal', null, real)).toBe(false);
  });
});

describe('median — storico dei tetti (B8)', () => {
  it('robusta a un periodo eccezionale, zeri inclusi', () => {
    expect(median([30, 0, 500])).toBe(30);
    expect(median([10, 20])).toBe(15);
  });
});

describe('getBudgetSuggestions — parametri e risparmio', () => {
  it('default: periodo di paga, periodo corrente, risparmio dal profilo', async () => {
    const res = makeRes();
    await getBudgetSuggestions({ userId: 'u1', query: {} } as any, res);
    expect(computeBudgetPlan).toHaveBeenCalledWith('u1', { mode: 'pay', offset: 0, accountIds: undefined });
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      savingRate: 0.1, savingTarget: 170, spendable: 830,
      remaining: 630, daysLeft: 27, perDay: 23.33, capsTotal: 0, capsScaled: false,
    }));
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

describe('applyBudgetSuggestions — periodo in corso o successivo (B2/B3)', () => {
  beforeEach(() => {
    // Oggi 15 giugno 2026 → finestra mensile corrente giugno, successiva luglio.
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 15, 12));
    budgetUpdate.mockImplementation((a: any) => ({ op: 'update', ...a }));
    budgetCreate.mockImplementation((a: any) => ({ op: 'create', ...a }));
    txn.mockImplementation(async (ops: any[]) => ops);
  });
  afterEach(() => vi.useRealTimers());

  const utcDay = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d));

  it('offset 0: aggiorna l\'attivo (ancorato a inizio finestra), crea il mancante, segnala periodo/riporto/overlap', async () => {
    categoryFindMany.mockResolvedValue([
      { id: 'food', name: 'Spesa', type: 'EXPENSE', isSystem: false },
      { id: 'fun', name: 'Svago', type: 'EXPENSE', isSystem: false },
    ]);
    budgetFindMany.mockResolvedValue([
      // Creato oggi alle 12: lo speso deve partire dal 1° giugno.
      { id: 'bf', name: 'Spesa', amount: 100, categoryId: 'food', period: 'MONTHLY', rollover: 'SURPLUS',
        startDate: new Date(2026, 5, 15, 12), endDate: null, category: { parentId: null } },
      // Budget su una sotto-categoria di "fun": la proposta macro lo comprende.
      { id: 'bc', name: 'Cinema', amount: 30, categoryId: 'cinema', period: 'MONTHLY', rollover: 'NONE',
        startDate: new Date(2026, 0, 1), endDate: null, category: { parentId: 'fun' } },
    ]);
    const res = makeRes();
    await applyBudgetSuggestions({
      userId: 'u1',
      body: { period: 'PAY_PERIOD', items: [{ categoryId: 'food', amount: 85 }, { categoryId: 'fun', amount: 17 }] },
    } as any, res);

    expect(budgetUpdate).toHaveBeenCalledWith({
      where: { id: 'bf' }, data: { amount: 85, period: 'PAY_PERIOD', rollover: 'NONE', startDate: utcDay(2026, 5, 1) },
    });
    expect(budgetCreate.mock.calls[0][0].data).toMatchObject({
      name: 'Svago', amount: 17, categoryId: 'fun', period: 'PAY_PERIOD', rollover: 'NONE', userId: 'u1',
      startDate: utcDay(2026, 5, 1),
    });
    expect(txn).toHaveBeenCalledTimes(1);
    expect(res.json).toHaveBeenCalledWith({
      applied: 2, created: 1, updated: 1, scheduled: 0,
      periodChanged: [{ categoryId: 'food', name: 'Spesa', from: 'MONTHLY', to: 'PAY_PERIOD' }],
      rolloverReset: [{ categoryId: 'food', name: 'Spesa' }],
      overlaps: [{ categoryId: 'fun', name: 'Svago', childBudgets: [{ id: 'bc', name: 'Cinema', amount: 30 }] }],
    });
  });

  it('offset 0: con solo un budget futuro lo anticipa all\'inizio finestra, senza crearne un secondo', async () => {
    categoryFindMany.mockResolvedValue([{ id: 'food', name: 'Spesa', type: 'EXPENSE', isSystem: false }]);
    budgetFindMany.mockResolvedValue([
      { id: 'bn', name: 'Spesa', amount: 95, categoryId: 'food', period: 'MONTHLY', rollover: 'NONE',
        startDate: utcDay(2026, 6, 1), endDate: null, category: { parentId: null } },
    ]);
    const res = makeRes();
    await applyBudgetSuggestions({ userId: 'u1', body: { items: [{ categoryId: 'food', amount: 90 }] } } as any, res);
    expect(budgetUpdate).toHaveBeenCalledWith({
      where: { id: 'bn' }, data: { amount: 90, period: 'MONTHLY', rollover: 'NONE', startDate: utcDay(2026, 5, 1) },
    });
    expect(budgetCreate).not.toHaveBeenCalled();
  });

  it('offset 0: non accorcia lo storico di un budget attivo da prima', async () => {
    categoryFindMany.mockResolvedValue([{ id: 'food', name: 'Spesa', type: 'EXPENSE', isSystem: false }]);
    budgetFindMany.mockResolvedValue([
      { id: 'bf', name: 'Spesa', amount: 100, categoryId: 'food', period: 'MONTHLY', rollover: 'NONE',
        startDate: utcDay(2026, 0, 1), endDate: null, category: { parentId: null } },
    ]);
    const res = makeRes();
    await applyBudgetSuggestions({ userId: 'u1', body: { items: [{ categoryId: 'food', amount: 90 }] } } as any, res);
    expect(budgetUpdate.mock.calls[0][0].data.startDate).toEqual(utcDay(2026, 0, 1));
  });

  it('offset 1: chiude l\'attivo alla vigilia e crea il budget dal periodo successivo', async () => {
    categoryFindMany.mockResolvedValue([{ id: 'food', name: 'Spesa', type: 'EXPENSE', isSystem: false }]);
    budgetFindMany.mockResolvedValue([
      { id: 'bf', name: 'Spesa mia', amount: 100, categoryId: 'food', period: 'MONTHLY', rollover: 'SURPLUS',
        startDate: utcDay(2026, 0, 1), endDate: null, category: { parentId: null } },
    ]);
    const res = makeRes();
    await applyBudgetSuggestions({ userId: 'u1', body: { period: 'MONTHLY', offset: 1, items: [{ categoryId: 'food', amount: 90 }] } } as any, res);
    // Il budget in corso non cambia importo: solo la fine al 30 giugno.
    expect(budgetUpdate).toHaveBeenCalledWith({ where: { id: 'bf' }, data: { endDate: utcDay(2026, 5, 30) } });
    expect(budgetCreate.mock.calls[0][0].data).toMatchObject({
      name: 'Spesa mia', amount: 90, period: 'MONTHLY', rollover: 'SURPLUS', startDate: utcDay(2026, 6, 1),
    });
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ created: 1, updated: 0, scheduled: 1, periodChanged: [], rolloverReset: [] }));
  });

  it('offset 1: aggiorna il budget futuro se esiste già', async () => {
    categoryFindMany.mockResolvedValue([{ id: 'food', name: 'Spesa', type: 'EXPENSE', isSystem: false }]);
    budgetFindMany.mockResolvedValue([
      { id: 'bf', name: 'Spesa', amount: 100, categoryId: 'food', period: 'MONTHLY', rollover: 'NONE',
        startDate: utcDay(2026, 0, 1), endDate: utcDay(2026, 5, 30), category: { parentId: null } },
      { id: 'bn', name: 'Spesa', amount: 95, categoryId: 'food', period: 'MONTHLY', rollover: 'NONE',
        startDate: utcDay(2026, 6, 1), endDate: null, category: { parentId: null } },
    ]);
    const res = makeRes();
    await applyBudgetSuggestions({ userId: 'u1', body: { offset: 1, items: [{ categoryId: 'food', amount: 80 }] } } as any, res);
    // L'attivo è già chiuso alla vigilia: si tocca solo il futuro.
    expect(budgetUpdate).toHaveBeenCalledTimes(1);
    expect(budgetUpdate).toHaveBeenCalledWith({
      where: { id: 'bn' }, data: { amount: 80, period: 'MONTHLY', rollover: 'NONE', startDate: utcDay(2026, 6, 1) },
    });
    expect(budgetCreate).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ created: 0, updated: 1, scheduled: 1 }));
  });

  it('rifiuta categorie di entrata o di sistema', async () => {
    categoryFindMany.mockResolvedValue([{ id: 'cc', name: 'Pagamento Carta', type: 'EXPENSE', isSystem: true }]);
    const res = makeRes();
    await applyBudgetSuggestions({ userId: 'u1', body: { items: [{ categoryId: 'cc', amount: 50 }] } } as any, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(txn).not.toHaveBeenCalled();
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

describe('createBudget — ancoraggio e validazione categoria', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 15, 12));
    budgetCreate.mockResolvedValue({ id: 'new' });
  });
  afterEach(() => vi.useRealTimers());

  it('senza startDate parte dall\'inizio della finestra corrente', async () => {
    const res = makeRes();
    await createBudget({ userId: 'u1', body: { name: 'Tutto', amount: 500, period: 'MONTHLY' } } as any, res);
    expect(budgetCreate.mock.calls[0][0].data.startDate).toEqual(new Date(Date.UTC(2026, 5, 1)));
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('con startDate la rispetta', async () => {
    const res = makeRes();
    await createBudget({ userId: 'u1', body: { name: 'Tutto', amount: 500, period: 'MONTHLY', startDate: '2026-06-10' } } as any, res);
    expect(budgetCreate.mock.calls[0][0].data.startDate).toEqual(new Date('2026-06-10'));
  });

  it('400 su categoria di entrata', async () => {
    categoryFindFirst.mockResolvedValueOnce({ id: 'sal', type: 'INCOME', isSystem: false });
    const res = makeRes();
    await createBudget({ userId: 'u1', body: { name: 'X', amount: 10, period: 'MONTHLY', categoryId: 'sal' } } as any, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(budgetCreate).not.toHaveBeenCalled();
  });
});
