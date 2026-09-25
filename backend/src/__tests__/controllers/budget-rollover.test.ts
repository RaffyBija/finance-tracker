import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// budget.controller importa il singleton prisma. Lo mockiamo: budget.findFirst/findMany
// per il record, transaction.aggregate per lo "speso" (qui usiamo budget SENZA categoria,
// così computeBudgetSpent passa per il solo ramo aggregate). Lo speso dipende dal mese
// della finestra (chiave = mese del gte del filtro data), così possiamo pilotare avanzo e
// sforamento periodo per periodo e verificare il folding del carry.
const { budgetFindFirst, budgetFindMany, txAggregate } = vi.hoisted(() => ({
  budgetFindFirst: vi.fn(),
  budgetFindMany: vi.fn(),
  txAggregate: vi.fn(),
}));
vi.mock('../../utils/prisma', () => ({
  default: {
    budget: { findFirst: budgetFindFirst, findMany: budgetFindMany },
    transaction: { aggregate: txAggregate },
  },
}));

import { getBudgetHistory, getBudgets } from '../../controllers/budget.controller';

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
    txAggregate.mockReset();
    // Speso in funzione del mese del gte (inizio finestra intersecata con startDate).
    txAggregate.mockImplementation(async ({ where }: any) => {
      const month = new Date(where.date.gte).getMonth();
      return { _sum: { amount: SPENT_BY_MONTH[month] ?? 0 } };
    });
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
    // startDate aprile → il fold del carry copre solo apr e mag (no gen-mar a zero).
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
  });

  it('FULL con debito > importo: envelope negativo → percentage 100 (non "verde")', async () => {
    // aprile sfora pesante (350 su 100), maggio 0, giugno 50.
    txAggregate.mockImplementation(async ({ where }: any) => {
      const m = new Date(where.date.gte).getMonth();
      const map: Record<number, number> = { 3: 350, 4: 0, 5: 50 };
      return { _sum: { amount: map[m] ?? 0 } };
    });
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
    txAggregate.mockResolvedValue({ _sum: { amount: 0 } });
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
    // Senza il fix (ancora a "ora") feb/mar sarebbero collassati a 100.
    expect(history[0].budgeted).toBe(100);
    expect(history[1].budgeted).toBe(200);
    expect(history[2].budgeted).toBe(300);
  });

  // bug_012: una finestra di attivazione PARZIALE non deve accreditare un envelope
  // intero (avanzo fantasma). Budget creato il 30 giugno → il 1° luglio niente carry.
  it('finestra di attivazione parziale non genera carry fantasma', async () => {
    vi.setSystemTime(new Date('2026-07-01T12:00:00.000Z'));
    txAggregate.mockResolvedValue({ _sum: { amount: 0 } });
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
