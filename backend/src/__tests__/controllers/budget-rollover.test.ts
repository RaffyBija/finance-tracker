import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// budget.controller legge lo speso da loadClassifiedExpenses (una lettura per richiesta,
// poi aggregazione in memoria). Lo mockiamo con righe datate a metà mese: così possiamo
// pilotare avanzo e sforamento periodo per periodo e verificare il folding del carry.
const { budgetFindFirst, budgetFindMany, categoryFindMany, loadLines } = vi.hoisted(() => ({
  budgetFindFirst: vi.fn(),
  budgetFindMany: vi.fn(),
  categoryFindMany: vi.fn(),
  loadLines: vi.fn(),
}));
vi.mock('../../utils/prisma', () => ({
  default: {
    budget: { findFirst: budgetFindFirst, findMany: budgetFindMany },
    category: { findMany: categoryFindMany },
    // Periodo di paga non configurato → PAY_PERIOD ricade sul mese.
    user: { findUnique: async () => null },
  },
}));
vi.mock('../../utils/spendingRhythm', async (orig) => ({
  ...(await orig<typeof import('../../utils/spendingRhythm')>()),
  loadClassifiedExpenses: loadLines,
}));

import { getBudgetHistory, getBudgets } from '../../controllers/budget.controller';

// Una riga variabile per mese (0-based, anno 2026) a metà mese.
const linesFor = (byMonth: Record<number, number>) =>
  Object.entries(byMonth).map(([m, amount]) => ({
    date: new Date(2026, Number(m), 15, 12),
    amount,
    categoryId: null,
    kind: 'variable',
  }));

// Speso per mese (0-based): aprile=80, maggio=150 (sforamento), giugno=50.
const SPENT_BY_MONTH: Record<number, number> = { 3: 80, 4: 150, 5: 50 };

const makeRes = () => {
  const res: any = {};
  res.json = vi.fn().mockReturnValue(res);
  res.status = vi.fn().mockReturnValue(res);
  return res;
};

// startDate aprile: il fold del carry (cap 12 finestre, filtrato da startDate) parte da
// aprile, così non entrano gen-mar a zero e i numeri attesi restano puliti.
const baseBudget = {
  id: 'b1',
  userId: 'u1',
  name: 'Svago',
  amount: 100,
  categoryId: null,
  period: 'MONTHLY',
  startDate: new Date('2026-04-01T00:00:00.000Z'),
  endDate: null,
};

describe('Budget carryover (rollover)', () => {
  beforeEach(() => {
    // "Oggi" = 15 giugno 2026 → finestre recenti: apr, mag, giu 2026.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-15T12:00:00.000Z'));
    budgetFindFirst.mockReset();
    budgetFindMany.mockReset();
    categoryFindMany.mockReset();
    categoryFindMany.mockResolvedValue([]);
    loadLines.mockReset();
    loadLines.mockResolvedValue(linesFor(SPENT_BY_MONTH));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const runHistory = async (rollover: 'NONE' | 'SURPLUS' | 'FULL') => {
    budgetFindFirst.mockResolvedValue({ ...baseBudget, rollover });
    const req: any = { userId: 'u1', params: { id: 'b1' }, query: { periods: 3 } };
    const res = makeRes();
    await getBudgetHistory(req, res);
    return res.json.mock.calls[0][0];
  };

  it('NONE: la soglia resta sempre l’importo base', async () => {
    const { history } = await runHistory('NONE');
    expect(history.map((h: any) => h.budgeted)).toEqual([100, 100, 100]);
    // maggio è l’unico sforamento (150 > 100)
    expect(history.map((h: any) => h.exceeded)).toEqual([false, true, false]);
  });

  it('SURPLUS: l’avanzo si riporta, lo sforamento NON penalizza', async () => {
    const { history } = await runHistory('SURPLUS');
    // aprile: 100 (carry 0); maggio: 100+20 avanzo aprile = 120; giugno: lo sforamento di
    // maggio non riporta debito → torna a 100.
    expect(history.map((h: any) => h.budgeted)).toEqual([100, 120, 100]);
  });

  it('FULL: si riporta anche lo sforamento, riducendo il budget successivo', async () => {
    const { history } = await runHistory('FULL');
    // aprile: 100; maggio: 120 (avanzo 20), spesi 150 → debito -30; giugno: 100-30 = 70.
    expect(history.map((h: any) => h.budgeted)).toEqual([100, 120, 70]);
    // giugno: speso 50 su 70 → non sforato
    const giugno = history[history.length - 1];
    expect(giugno.exceeded).toBe(false);
  });

  it('finestra precedente all’attivazione non entra nello storico', async () => {
    budgetFindFirst.mockResolvedValue({
      ...baseBudget,
      rollover: 'SURPLUS',
      startDate: new Date('2026-05-01T00:00:00.000Z'),
    });
    const req: any = { userId: 'u1', params: { id: 'b1' }, query: { periods: 3 } };
    const res = makeRes();
    await getBudgetHistory(req, res);
    const { history } = res.json.mock.calls[0][0];
    // aprile escluso (budget attivo da maggio) → solo mag, giu
    expect(history).toHaveLength(2);
    expect(history.map((h: any) => h.budgeted)).toEqual([100, 100]);
  });

  it('getBudgets espone carryIn e effectiveAmount sul periodo corrente', async () => {
    budgetFindMany.mockResolvedValue([
      { ...baseBudget, rollover: 'SURPLUS', startDate: new Date('2026-04-01T00:00:00.000Z') },
    ]);
    const req: any = { userId: 'u1', query: {} };
    const res = makeRes();
    await getBudgets(req, res);
    const [card] = res.json.mock.calls[0][0];
    // carryIn della finestra corrente (giugno) = fold su apr (+20) e mag (sforato → 0) = 0.
    expect(card.carryIn).toBe(0);
    expect(card.effectiveAmount).toBe(100);
    expect(card.spent).toBe(50);
    expect(card.remaining).toBe(50);
    // Una sola lettura delle righe per tutta la richiesta (niente N+1).
    expect(loadLines).toHaveBeenCalledTimes(1);
  });

  it('FULL con debito > importo: envelope negativo → percentage 100 (non "verde")', async () => {
    // aprile sfora pesante (350 su 100), maggio 0, giugno 50.
    loadLines.mockResolvedValue(linesFor({ 3: 350, 5: 50 }));
    budgetFindMany.mockResolvedValue([{ ...baseBudget, rollover: 'FULL' }]);
    const req: any = { userId: 'u1', query: {} };
    const res = makeRes();
    await getBudgets(req, res);
    const [card] = res.json.mock.calls[0][0];
    // carryIn giugno = fold apr(-250) → may(-150). effectiveAmount = 100 - 150 = -50.
    expect(card.carryIn).toBe(-150);
    expect(card.effectiveAmount).toBe(-50);
    expect(card.remaining).toBe(-100);
    // envelope negativo: lo stato deve restare "sforato", non collassare a 0.
    expect(card.percentage).toBe(100);
  });

  it('getBudgets con rollover NONE non riporta nulla', async () => {
    budgetFindMany.mockResolvedValue([{ ...baseBudget, rollover: 'NONE' }]);
    const req: any = { userId: 'u1', query: {} };
    const res = makeRes();
    await getBudgets(req, res);
    const [card] = res.json.mock.calls[0][0];
    expect(card.carryIn).toBe(0);
    expect(card.effectiveAmount).toBe(100);
  });

  // bug_001: il carry delle finestre storiche deve essere ancorato alla finestra
  // richiesta, non a "ora". Per un periodo molto indietro (>MAX_ROLLOVER_PERIODS dal
  // presente) il fold non deve collassare a 0.
  it('getBudgetHistory: carry corretto anche su finestre molto vecchie (ancora ≠ ora)', async () => {
    // Nessuna spesa: in SURPLUS l’avanzo pieno si accumula periodo dopo periodo.
    loadLines.mockResolvedValue([]);
    budgetFindFirst.mockResolvedValue({
      ...baseBudget,
      rollover: 'SURPLUS',
      startDate: new Date('2025-01-01T00:00:00.000Z'),
    });
    const req: any = { userId: 'u1', params: { id: 'b1' }, query: { periods: 24 } };
    const res = makeRes();
    await getBudgetHistory(req, res);
    const { history } = res.json.mock.calls[0][0];
    // gen 2025 = prima finestra (carry 0 → 100); feb = 100+100; mar = 100+200.
    expect(history[0].budgeted).toBe(100);
    expect(history[1].budgeted).toBe(200);
    expect(history[2].budgeted).toBe(300);
  });

  // bug_012: una finestra di attivazione PARZIALE non deve accreditare un envelope
  // intero (avanzo fantasma). Budget creato il 30 giugno → il 1° luglio niente carry.
  it('finestra di attivazione parziale non genera carry fantasma', async () => {
    vi.setSystemTime(new Date('2026-07-01T12:00:00.000Z'));
    loadLines.mockResolvedValue([]);
    budgetFindMany.mockResolvedValue([
      { ...baseBudget, rollover: 'SURPLUS', startDate: new Date('2026-06-30T00:00:00.000Z') },
    ]);
    const req: any = { userId: 'u1', query: {} };
    const res = makeRes();
    await getBudgets(req, res);
    const [card] = res.json.mock.calls[0][0];
    // giugno coperto solo per 1 giorno → escluso dal fold → nessun riporto.
    expect(card.carryIn).toBe(0);
    expect(card.effectiveAmount).toBe(100);
  });
});

describe('Speso = solo spesa variabile (B1)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-15T12:00:00.000Z'));
    budgetFindMany.mockReset();
    // Macro "casa" con figlia "affitto" (archiviata: la gerarchia resta).
    categoryFindMany.mockResolvedValue([
      { id: 'casa', parentId: null },
      { id: 'affitto', parentId: 'casa' },
      { id: 'cibo', parentId: null },
    ]);
    loadLines.mockResolvedValue([
      // Affitto da ricorrente: fisso → fuori dallo speso, in fixedSpent.
      { date: new Date(2026, 5, 5), amount: 600, categoryId: 'affitto', kind: 'fixed' },
      // Riga split variabile sulla figlia + una sulla macro.
      { date: new Date(2026, 5, 10), amount: 40, categoryId: 'affitto', kind: 'variable' },
      { date: new Date(2026, 5, 11), amount: 25, categoryId: 'casa', kind: 'variable' },
      // Rata pianificata sulla macro: fissa.
      { date: new Date(2026, 5, 12), amount: 99, categoryId: 'casa', kind: 'planned' },
      // Altra categoria e senza categoria: solo nel globale.
      { date: new Date(2026, 5, 13), amount: 30, categoryId: 'cibo', kind: 'variable' },
      { date: new Date(2026, 5, 14), amount: 5, categoryId: null, kind: 'variable' },
    ]);
  });
  afterEach(() => vi.useRealTimers());

  it('budget su macro: macro + figlie, fisse in fixedSpent; globale = tutta la variabile', async () => {
    budgetFindMany.mockResolvedValue([
      { ...baseBudget, id: 'bc', categoryId: 'casa', amount: 300, rollover: 'NONE' },
      { ...baseBudget, id: 'bg', categoryId: null, amount: 1000, rollover: 'NONE' },
    ]);
    const res = makeRes();
    await getBudgets({ userId: 'u1', query: {} } as any, res);
    const [casa, globale] = res.json.mock.calls[0][0];
    expect(casa.spent).toBe(65);
    expect(casa.fixedSpent).toBe(699);
    expect(casa.percentage).toBeCloseTo(65 / 3);
    expect(globale.spent).toBe(100);
    expect(globale.fixedSpent).toBe(699);
    expect(casa.status).toBe('active');
    expect(casa.payPeriodFallback).toBe(false);
  });

  it('endDate include il giorno finale; status upcoming/expired; fallback PAY_PERIOD', async () => {
    budgetFindMany.mockResolvedValue([
      // Scade il 13 giugno (oggi 15): conta anche la spesa del 13.
      { ...baseBudget, id: 'e', categoryId: null, rollover: 'NONE', endDate: new Date(2026, 5, 13) },
      { ...baseBudget, id: 'u', categoryId: null, rollover: 'NONE', startDate: new Date('2026-07-01T00:00:00.000Z') },
      // PAY_PERIOD senza periodo di paga configurato (nessun utente nel mock) → mese.
      { ...baseBudget, id: 'p', categoryId: 'cibo', period: 'PAY_PERIOD', rollover: 'NONE' },
    ]);
    const res = makeRes();
    await getBudgets({ userId: 'u1', query: {} } as any, res);
    const [expired, upcoming, pay] = res.json.mock.calls[0][0];
    expect(expired.status).toBe('expired');
    expect(expired.spent).toBe(95); // 40 + 25 + 30 (fino al 13 incluso)
    expect(upcoming.status).toBe('upcoming');
    expect(upcoming.spent).toBe(0);
    expect(upcoming.periodLabel).toBe('luglio 2026'); // prima finestra in cui sarà attivo
    expect(pay.payPeriodFallback).toBe(true);
    expect(pay.spent).toBe(30);
  });
});
