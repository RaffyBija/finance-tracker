import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mock del singleton Prisma (solo i metodi toccati dai due endpoint) ──
const {
  userFindUnique,
  recurringFindMany,
  plannedFindMany,
  txFindMany,
  budgetFindMany,
  categoryFindMany,
  accountFindMany,
  budgetUpdate,
  budgetCreate,
  txn,
} = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  recurringFindMany: vi.fn(),
  plannedFindMany: vi.fn(),
  txFindMany: vi.fn(),
  budgetFindMany: vi.fn(),
  categoryFindMany: vi.fn(),
  accountFindMany: vi.fn(),
  budgetUpdate: vi.fn(),
  budgetCreate: vi.fn(),
  txn: vi.fn(),
}));

vi.mock('../../utils/prisma', () => ({
  default: {
    user: { findUnique: userFindUnique },
    recurringTransaction: { findMany: recurringFindMany },
    plannedTransaction: { findMany: plannedFindMany },
    transaction: { findMany: txFindMany },
    budget: { findMany: budgetFindMany, update: budgetUpdate, create: budgetCreate },
    category: { findMany: categoryFindMany },
    account: { findMany: accountFindMany },
    $transaction: txn,
  },
}));

// Cuscinetto e addebiti CC pilotati dai mock di balance.ts.
const { getAccountsWithBalances, getLiquidBalance, openCCObligations } = vi.hoisted(() => ({
  getAccountsWithBalances: vi.fn(),
  getLiquidBalance: vi.fn(),
  openCCObligations: vi.fn(),
}));
vi.mock('../../utils/balance', () => ({
  getAccountsWithBalances,
  getLiquidBalance,
  openCCObligations,
}));

// Cache sempre "miss" → ricalcolo deterministico a ogni chiamata.
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

const histTx = (categoryId: string, amount: number, name: string) => ({
  amount,
  categoryId,
  category: { id: categoryId, name, color: '#fff', icon: '🍔' },
  items: [],
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-06-15T12:00:00.000Z'));
  vi.clearAllMocks();
  // Default neutri
  recurringFindMany.mockResolvedValue([]);
  plannedFindMany.mockResolvedValue([]);
  txFindMany.mockResolvedValue([]);
  budgetFindMany.mockResolvedValue([]);
  categoryFindMany.mockResolvedValue([]); // nessuna categoria di sistema per default
  getAccountsWithBalances.mockResolvedValue([]);
  getLiquidBalance.mockResolvedValue(0);
  openCCObligations.mockReturnValue({ total: 0, count: 0 });
  accountFindMany.mockResolvedValue([]);
  userFindUnique.mockResolvedValue({ savingRate: 0 });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('getBudgetSuggestions — formula dello spendibile', () => {
  it('spendibile = entrate + cuscinetto(liquidità pura) − fissi(+CC dovuto nel mese) − risparmio', async () => {
    plannedFindMany.mockResolvedValue([
      { type: 'INCOME', amount: 1000 },
      { type: 'EXPENSE', amount: 200 },
    ]);
    // Una CC con debito 100 il cui addebito cade NEL MESE corrente: va contato tra gli
    // impegni fissi (come nella proiezione), NON scontato a priori dal cuscinetto.
    getAccountsWithBalances.mockResolvedValue([
      { id: 'cc1', type: 'CREDIT_CARD', balance: -100 },
    ]);
    getLiquidBalance.mockResolvedValue(500);
    openCCObligations.mockReturnValue({ total: 100, count: 1 }); // addebito dovuto questo mese
    userFindUnique.mockResolvedValue({ savingRate: 0.2 });

    const req: any = { userId: 'u1', query: {} };
    const res = makeRes();
    await getBudgetSuggestions(req, res);
    const out = res.json.mock.calls[0][0];

    expect(out.expectedIncome).toBe(1000);
    expect(out.fixedCommitments).toBe(300); // 200 pianificata + 100 addebito CC del mese
    expect(out.cushion).toBe(500); // liquidità pura, niente sottrazione CC
    expect(out.liquidity).toBe(500); // saldo conti (per il breakdown)
    expect(out.ccDueThisMonth).toBe(100); // quota CC dentro gli impegni fissi
    expect(out.savingRate).toBe(0.2);
    // risparmio = quota del DISPONIBILE (1000+500−300=1200), non delle sole entrate
    expect(out.savingTarget).toBe(240); // max(0, 1200) * 0.2
    expect(out.spendable).toBe(960); // 1200 − 240
  });

  it('il debito CC NON pesa sul mese corrente se l’addebito cade in un mese successivo', async () => {
    // Liquidità piena e una CC con debito il cui prossimo billing day è FUORI dal mese
    // (openCCObligations → 0 per questa finestra). Il debito non deve ridurre lo
    // spendibile del mese corrente: peserà sul mese dell'addebito (come la proiezione).
    getAccountsWithBalances.mockResolvedValue([
      { id: 'cc1', type: 'CREDIT_CARD', balance: -250 },
      { id: 'bank1', type: 'BANK', balance: 1000 },
    ]);
    getLiquidBalance.mockResolvedValue(1000);
    openCCObligations.mockReturnValue({ total: 0, count: 0 }); // addebito fuori dal mese

    const req: any = { userId: 'u1', query: {} };
    const res = makeRes();
    await getBudgetSuggestions(req, res);
    const out = res.json.mock.calls[0][0];

    expect(out.cushion).toBe(1000); // liquidità piena, il debito CC non è scontato qui
    expect(out.spendable).toBe(1000); // 1000 + 0 − 0 − 0 (il debito 250 peserà sul mese dell'addebito)
  });

  it('mese a reddito zero: lo spendibile resta positivo grazie al cuscinetto', async () => {
    plannedFindMany.mockResolvedValue([{ type: 'EXPENSE', amount: 300 }]);
    getLiquidBalance.mockResolvedValue(800);
    userFindUnique.mockResolvedValue({ savingRate: 0 });

    const req: any = { userId: 'u1', query: {} };
    const res = makeRes();
    await getBudgetSuggestions(req, res);
    const out = res.json.mock.calls[0][0];

    expect(out.expectedIncome).toBe(0);
    expect(out.fixedCommitments).toBe(300);
    expect(out.spendable).toBe(500); // 0 + 800 − 300 − 0, NON negativo
  });

  it('reddito zero con savingRate > 0: il risparmio si calcola sul disponibile (cuscinetto)', async () => {
    // Regression: prima savingTarget = entrate × rate → sempre 0 senza entrate.
    // Ora è una quota del disponibile, quindi lo slider funziona anche a reddito zero.
    plannedFindMany.mockResolvedValue([{ type: 'EXPENSE', amount: 300 }]);
    getLiquidBalance.mockResolvedValue(800);
    userFindUnique.mockResolvedValue({ savingRate: 0.2 });

    const req: any = { userId: 'u1', query: {} };
    const res = makeRes();
    await getBudgetSuggestions(req, res);
    const out = res.json.mock.calls[0][0];

    expect(out.expectedIncome).toBe(0);
    expect(out.savingTarget).toBe(100); // max(0, 0 + 800 − 300) * 0.2 = 100
    expect(out.spendable).toBe(400); // 500 − 100
  });

  it('disponibile negativo (in rosso): nessun risparmio, clamp a 0', async () => {
    plannedFindMany.mockResolvedValue([{ type: 'EXPENSE', amount: 300 }]);
    getLiquidBalance.mockResolvedValue(-500); // liquidità negativa
    userFindUnique.mockResolvedValue({ savingRate: 0.3 });

    const req: any = { userId: 'u1', query: {} };
    const res = makeRes();
    await getBudgetSuggestions(req, res);
    const out = res.json.mock.calls[0][0];

    expect(out.savingTarget).toBe(0); // disponibile −800 → clamp a 0
    expect(out.spendable).toBe(-800); // 0 + (−500) − 300 − 0
  });

  it('override savingRate via query (anteprima slider) ha precedenza sul profilo', async () => {
    plannedFindMany.mockResolvedValue([{ type: 'INCOME', amount: 1000 }]);
    userFindUnique.mockResolvedValue({ savingRate: 0.5 });

    const req: any = { userId: 'u1', query: { savingRate: '0' } };
    const res = makeRes();
    await getBudgetSuggestions(req, res);
    const out = res.json.mock.calls[0][0];

    expect(out.savingRate).toBe(0);
    expect(out.savingTarget).toBe(0);
  });

  it('tetti per categoria = media storica − taglio standard, ordinati, con currentBudgetId', async () => {
    txFindMany.mockResolvedValue([
      histTx('food', 300, 'Spesa'), // media 100 → cap 85
      histTx('fun', 60, 'Svago'), //  media 20  → cap 17
    ]);
    budgetFindMany.mockResolvedValue([{ id: 'bf', categoryId: 'food', amount: 90 }]);

    const req: any = { userId: 'u1', query: {} };
    const res = makeRes();
    await getBudgetSuggestions(req, res);
    const out = res.json.mock.calls[0][0];

    expect(out.perCategory).toHaveLength(2);
    const [first, second] = out.perCategory;
    expect(first.categoryId).toBe('food');
    expect(first.avgMonthly).toBe(100);
    expect(first.suggestedCap).toBe(85);
    expect(first.currentBudgetId).toBe('bf');
    expect(first.currentAmount).toBe(90);
    expect(second.categoryId).toBe('fun');
    expect(second.suggestedCap).toBe(17);
    expect(second.currentBudgetId).toBeNull();
  });

  it('esclude le categorie di sistema (addebiti CC) dalle medie storiche', async () => {
    txFindMany.mockResolvedValue([
      histTx('food', 300, 'Spesa'),
      histTx('settlement', 900, 'Pagamento Carta'), // categoria di sistema
    ]);
    categoryFindMany.mockResolvedValue([{ id: 'settlement' }]); // marcata isSystem

    const req: any = { userId: 'u1', query: {} };
    const res = makeRes();
    await getBudgetSuggestions(req, res);
    const out = res.json.mock.calls[0][0];

    expect(out.perCategory).toHaveLength(1);
    expect(out.perCategory[0].categoryId).toBe('food');
  });
});

describe('getBudgetSuggestions — mese prossimo (monthOffset=1)', () => {
  it('proietta il cuscinetto a inizio mese prossimo includendo lo stipendio residuo', async () => {
    // Stipendio MONTHLY il 23 (oggi è il 15): non ancora incassato, ma cade in giugno.
    // Per il mese prossimo (luglio) va aggiunto al cuscinetto proiettato.
    recurringFindMany.mockResolvedValue([
      {
        type: 'INCOME',
        amount: 1000,
        frequency: 'MONTHLY',
        dayOfMonth: 23,
        startDate: new Date('2026-01-23T00:00:00.000Z'),
        endDate: null,
      },
    ]);
    getLiquidBalance.mockResolvedValue(500);

    const req: any = { userId: 'u1', query: { monthOffset: '1' } };
    const res = makeRes();
    await getBudgetSuggestions(req, res);
    const out = res.json.mock.calls[0][0];

    expect(out.monthOffset).toBe(1);
    expect(out.expectedIncome).toBe(1000); // occorrenza di luglio
    expect(out.cushion).toBe(1500); // 500 liquidità + 1000 stipendio residuo di giugno
    expect(out.spendable).toBe(2500); // 1000 + 1500 − 0 − 0
  });

  it('include nel cuscinetto residuo anche un flusso che cade OGGI (range-start a mezzanotte)', async () => {
    // Oggi è il 15 alle 12:00. Una pianificata di entrata datata oggi (mezzanotte) deve
    // entrare nel cuscinetto residuo: il range-start va normalizzato a inizio giornata,
    // altrimenti il confronto con l'ora corrente la escluderebbe.
    plannedFindMany.mockImplementation(async ({ where }: any) => {
      // plannedResidual: finestra [oggi 00:00, fine giugno]
      const gte: Date = where.plannedDate.gte;
      if (gte.getDate() === 15) {
        return [{ type: 'INCOME', amount: 400, plannedDate: new Date('2026-06-15T00:00:00.000Z') }];
      }
      return []; // plannedMonth (luglio)
    });
    getLiquidBalance.mockResolvedValue(100);

    const req: any = { userId: 'u1', query: { monthOffset: '1' } };
    const res = makeRes();
    await getBudgetSuggestions(req, res);
    const out = res.json.mock.calls[0][0];

    expect(out.cushion).toBe(500); // 100 + 400 (flusso di oggi incluso)
  });

  it('sottrae dal cuscinetto proiettato gli addebiti CC dovuti entro fine mese corrente', async () => {
    // Per il mese prossimo, un addebito CC che cade nella finestra residua [oggi, fine
    // giugno] riduce la liquidità proiettata a inizio luglio (come la proiezione).
    getLiquidBalance.mockResolvedValue(1000);
    // openCCObligations è chiamato per la finestra residua (giugno) e per il mese target
    // (luglio). Distinguiamo dalla finestra (non dall'ordine di chiamata): 300 dovuti a
    // giugno, nulla a luglio.
    openCCObligations.mockImplementation((_accts: any, _start: Date, end: Date) =>
      end.getMonth() === 5 ? { total: 300, count: 1 } : { total: 0, count: 0 },
    );

    const req: any = { userId: 'u1', query: { monthOffset: '1' } };
    const res = makeRes();
    await getBudgetSuggestions(req, res);
    const out = res.json.mock.calls[0][0];

    expect(out.cushion).toBe(700); // 1000 − 300 addebito CC dovuto entro fine giugno
    expect(out.fixedCommitments).toBe(0); // nessun addebito CC dovuto a luglio
  });
});

describe('getBudgetSuggestions — filtro conti (accountIds)', () => {
  it('somma SOLO i conti BANK selezionati nel cuscinetto (no fallback getLiquidBalance)', async () => {
    getAccountsWithBalances.mockResolvedValue([
      { id: 'bank1', type: 'BANK', balance: 1000 },
      { id: 'bank2', type: 'BANK', balance: 5000 },
    ]);
    getLiquidBalance.mockResolvedValue(6000); // NON deve essere usato col filtro attivo
    accountFindMany.mockResolvedValue([{ id: 'bank1' }]); // bank1 valido

    const req: any = { userId: 'u1', query: { accountIds: 'bank1' } };
    const res = makeRes();
    await getBudgetSuggestions(req, res);
    const out = res.json.mock.calls[0][0];

    expect(out.cushion).toBe(1000); // solo bank1
    expect(out.spendable).toBe(1000);
  });

  it('accountIds tutti ignoti: nessun filtro, ricade su getLiquidBalance', async () => {
    getAccountsWithBalances.mockResolvedValue([{ id: 'bank1', type: 'BANK', balance: 1000 }]);
    getLiquidBalance.mockResolvedValue(6000);
    accountFindMany.mockResolvedValue([]); // nessun id valido

    const req: any = { userId: 'u1', query: { accountIds: 'ghost' } };
    const res = makeRes();
    await getBudgetSuggestions(req, res);
    const out = res.json.mock.calls[0][0];

    expect(out.cushion).toBe(6000);
  });
});

describe('applyBudgetSuggestions — upsert per categoria', () => {
  beforeEach(() => {
    budgetUpdate.mockResolvedValue({});
    budgetCreate.mockResolvedValue({});
    txn.mockImplementation(async (ops: any[]) => ops);
  });

  it('aggiorna il budget esistente e crea quello mancante', async () => {
    categoryFindMany.mockResolvedValue([
      { id: 'food', name: 'Spesa' },
      { id: 'fun', name: 'Svago' },
    ]);
    budgetFindMany.mockResolvedValue([{ id: 'bf', categoryId: 'food' }]);

    const req: any = {
      userId: 'u1',
      body: {
        items: [
          { categoryId: 'food', amount: 85 },
          { categoryId: 'fun', amount: 17 },
        ],
      },
    };
    const res = makeRes();
    await applyBudgetSuggestions(req, res);

    expect(budgetUpdate).toHaveBeenCalledWith({ where: { id: 'bf' }, data: { amount: 85 } });
    expect(budgetCreate).toHaveBeenCalledTimes(1);
    const createArg = budgetCreate.mock.calls[0][0].data;
    expect(createArg).toMatchObject({
      name: 'Svago',
      amount: 17,
      categoryId: 'fun',
      period: 'MONTHLY',
      rollover: 'NONE',
      userId: 'u1',
    });
    expect(res.json).toHaveBeenCalledWith({ applied: 2 });
  });

  it('rifiuta importi non positivi', async () => {
    const req: any = { userId: 'u1', body: { items: [{ categoryId: 'food', amount: 0 }] } };
    const res = makeRes();
    await applyBudgetSuggestions(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('rifiuta items vuoto o assente', async () => {
    const req: any = { userId: 'u1', body: {} };
    const res = makeRes();
    await applyBudgetSuggestions(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('404 se una categoria non appartiene all’utente', async () => {
    categoryFindMany.mockResolvedValue([]); // nessuna delle categorie trovata
    const req: any = { userId: 'u1', body: { items: [{ categoryId: 'ghost', amount: 50 }] } };
    const res = makeRes();
    await applyBudgetSuggestions(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});
