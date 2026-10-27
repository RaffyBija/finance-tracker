import { Response } from 'express';
import prisma from '../utils/prisma';
import { AuthRequest, CreateBudgetDTO } from '../types';
import { Budget, BudgetPeriod, Prisma } from '@prisma/client';
import {
  BudgetWindow,
  budgetWindowFor,
  currentBudgetWindow,
  recentBudgetWindows,
  budgetWindowLabel,
} from '../utils/budgetPeriod';
import { computeBudgetPlan, applySaving, scaleCaps, planPace, type BudgetPlan } from '../utils/budgetPlan';
import {
  type BudgetLike,
  type BudgetSpendContext,
  activeRange,
  budgetCategorySet,
  carryIn,
  carryWindows,
  endOfLocalDay,
  loadBudgetSpendContext,
  startOfLocalDay,
  sumBudgetSpent,
} from '../utils/budgetSpent';
import { loadPayBoundaries, addDays, daysBetween } from '../utils/payPeriod';
import { analyticsCache } from '../utils/analyticsCache';

// Percentuale di utilizzo rispetto al budget EFFETTIVO (base + riporto). Quando
// l'envelope è esaurito o negativo (debito riportato in modalità FULL), qualunque
// spesa — o il debito stesso — è uno sforamento: ritorniamo 100 così lo stato resta
// "over" (icona rossa, barra piena) coerente con `remaining` negativo, invece di
// collassare a 0 (che mostrerebbe la card come "entro il budget").
const budgetPercentage = (spent: number, envelope: number): number => {
  if (envelope > 0) return (spent / envelope) * 100;
  return spent > 0 || envelope < 0 ? 100 : 0;
};

// Confini del periodo di paga per le finestre PAY_PERIOD, caricati una volta per
// richiesta e solo se serve. Copertura: riporto (12 periodi) + storico (24) e un
// margine in avanti. null = periodo di paga non configurato → finestre mensili.
type PayBoundaries = Date[] | null;
const payBoundariesFor = async (userId: string, periods: BudgetPeriod[]): Promise<PayBoundaries> => {
  if (!periods.includes('PAY_PERIOD')) return null;
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - 40, 1);
  return loadPayBoundaries(userId, from, addDays(now, 80), now);
};

type BudgetStatus = 'active' | 'upcoming' | 'expired';
const budgetStatus = (b: BudgetLike, now: Date): BudgetStatus =>
  startOfLocalDay(b.startDate) > now
    ? 'upcoming'
    : b.endDate && endOfLocalDay(b.endDate) < now
      ? 'expired'
      : 'active';

// Finestra mostrata sulla card: quella corrente; per un budget futuro la prima in
// cui sarà attivo, per uno scaduto l'ultima.
const cardWindow = (b: Budget, status: BudgetStatus, now: Date, pay: PayBoundaries): BudgetWindow =>
  currentBudgetWindow(
    b.period,
    status === 'upcoming' ? startOfLocalDay(b.startDate) : status === 'expired' ? startOfLocalDay(b.endDate!) : now,
    pay,
  );

// Budget + speso del periodo (solo variabile), impegni fissi informativi e riporto.
const withSpent = <T extends Budget>(
  ctx: BudgetSpendContext,
  budget: T,
  window: BudgetWindow,
  status: BudgetStatus,
  pay: PayBoundaries,
) => {
  const cats = budgetCategorySet(budget.categoryId, ctx.categories);
  const { spent, fixedSpent } = sumBudgetSpent(ctx.lines, budget, window, cats);
  const carry = carryIn(ctx, budget, window, pay);
  const effectiveAmount = Number(budget.amount) + carry;
  return {
    ...budget,
    spent,
    fixedSpent,
    carryIn: carry,
    effectiveAmount,
    remaining: effectiveAmount - spent,
    percentage: budgetPercentage(spent, effectiveAmount),
    periodStart: window.periodStart,
    periodEnd: window.periodEnd,
    periodLabel: budgetWindowLabel(window, budget.period),
    status,
    // PAY_PERIOD senza periodo di paga configurato: finestre = mese solare.
    payPeriodFallback: budget.period === 'PAY_PERIOD' && !pay,
  };
};

// Speso di più budget con una sola lettura delle righe (finestre + riporto).
const budgetsWithSpent = async <T extends Budget>(userId: string, budgets: T[]) => {
  const now = new Date();
  const pay = await payBoundariesFor(userId, budgets.map((b) => b.period));
  const items = budgets.map((b) => {
    const status = budgetStatus(b, now);
    return { b, status, window: cardWindow(b, status, now, pay) };
  });
  const ctx = await loadBudgetSpendContext(
    userId,
    items.flatMap((i) => [i.window, ...carryWindows(i.b, i.window, pay)]),
  );
  return items.map((i) => withSpent(ctx, i.b, i.window, i.status, pay));
};

// Ottieni tutti i budget
export const getBudgets = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { active } = req.query;

    const where: Prisma.BudgetWhereInput = { userId };

    // Filtra solo budget attivi
    if (active === 'true') {
      // endDate è a mezzanotte del giorno finale: il budget resta attivo per tutto quel giorno.
      const now = new Date();
      where.startDate = { lte: now };
      where.OR = [
        { endDate: null },
        { endDate: { gte: startOfLocalDay(now) } },
      ];
    }

    const budgets = await prisma.budget.findMany({
      where,
      include: {
        category: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.json(await budgetsWithSpent(userId, budgets));
  } catch (error) {
    console.error('Get budgets error:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
};

// Ottieni un singolo budget
export const getBudget = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const budget = await prisma.budget.findFirst({
      where: { id, userId },
      include: { category: true },
    });

    if (!budget) {
      return res.status(404).json({ error: 'Budget non trovato' });
    }

    const [budgetWithSpent] = await budgetsWithSpent(userId, [budget]);
    res.json(budgetWithSpent);
  } catch (error) {
    console.error('Get budget error:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
};

// Storico per-periodo di un budget: budget vs reale su N periodi recenti.
// Le finestre interamente precedenti a startDate o successive a endDate vengono
// scartate (il budget non era attivo). Restituisce anche statistiche aggregate.
export const getBudgetHistory = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const requested = Number(req.query.periods);
    const periods = Math.min(Math.max(Number.isFinite(requested) ? requested : 6, 1), 24);

    const budget = await prisma.budget.findFirst({
      where: { id, userId },
    });

    if (!budget) {
      return res.status(404).json({ error: 'Budget non trovato' });
    }

    const amount = Number(budget.amount);
    const pay = await payBoundariesFor(userId, [budget.period]);
    const windows = recentBudgetWindows(budget.period, periods, new Date(), pay);

    // Tieni solo le finestre che intersecano l'intervallo di attività del budget.
    const validWindows = windows.filter((w) => activeRange(budget, w) !== null);

    // Soglia (budgeted) per finestra = amount + carry, con lo STESSO fold della card
    // (cap MAX_ROLLOVER_PERIODS): la soglia del periodo corrente coincide con
    // effectiveAmount. Righe lette una volta sull'unione delle finestre.
    const ctx = await loadBudgetSpendContext(
      userId,
      validWindows.flatMap((w) => [w, ...carryWindows(budget, w, pay)]),
    );
    const cats = budgetCategorySet(budget.categoryId, ctx.categories);
    const history = validWindows.map((w) => {
      const { spent } = sumBudgetSpent(ctx.lines, budget, w, cats);
      const budgeted = amount + carryIn(ctx, budget, w, pay);
      return {
        periodStart: w.periodStart,
        periodEnd: w.periodEnd,
        label: budgetWindowLabel(w, budget.period),
        budgeted,
        spent,
        remaining: budgeted - spent,
        percentage: budgetPercentage(spent, budgeted),
        exceeded: spent > budgeted,
      };
    });

    // Statistiche aggregate
    const totalPeriods = history.length;
    const exceededCount = history.filter((h) => h.exceeded).length;
    const avgSpent =
      totalPeriods > 0 ? history.reduce((s, h) => s + h.spent, 0) / totalPeriods : 0;
    const adherenceRate =
      totalPeriods > 0 ? ((totalPeriods - exceededCount) / totalPeriods) * 100 : 0;

    let bestPeriod: (typeof history)[number] | null = null;
    let worstPeriod: (typeof history)[number] | null = null;
    for (const h of history) {
      if (!bestPeriod || h.spent < bestPeriod.spent) bestPeriod = h;
      if (!worstPeriod || h.spent > worstPeriod.spent) worstPeriod = h;
    }

    res.json({
      period: budget.period,
      history,
      stats: {
        avgSpent,
        adherenceRate,
        exceededCount,
        totalPeriods,
        bestPeriod,
        worstPeriod,
      },
    });
  } catch (error) {
    console.error('Get budget history error:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
};

// Il budget conta la spesa variabile di categorie di SPESA dell'utente: niente
// entrate né categorie di sistema ("Pagamento Carta"). Restituisce l'errore o null.
const invalidBudgetCategory = (
  c: { type: string; isSystem: boolean } | null | undefined,
): { status: number; error: string } | null => {
  if (!c) return { status: 404, error: 'Categoria non trovata' };
  if (c.type !== 'EXPENSE') return { status: 400, error: 'Il budget si può impostare solo su categorie di spesa' };
  if (c.isSystem) return { status: 400, error: 'Non puoi impostare un budget su una categoria di sistema' };
  return null;
};

// Data "solo giorno" come la salva il form (mezzanotte UTC del giorno locale).
const dateOnly = (d: Date): Date => new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));

// Crea un budget
export const createBudget = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { name, amount, categoryId, period, startDate, endDate, rollover }: CreateBudgetDTO =
      req.body;

    if (!name || !amount || amount <= 0 || !period) {
      return res.status(400).json({ error: 'Dati non validi' });
    }

    if (rollover !== undefined && !['NONE', 'SURPLUS', 'FULL'].includes(rollover)) {
      return res.status(400).json({ error: 'Modalità di riporto non valida' });
    }

    // Il form invia categoryId: '' per il budget complessivo. Normalizziamo a null:
    // passare '' come foreign key a Prisma viola il vincolo (nessuna categoria con id
    // '') → P2003 → 500. Con null il budget è correttamente "senza categoria".
    const normalizedCategoryId =
      typeof categoryId === 'string' && categoryId.trim() !== '' ? categoryId : null;

    if (normalizedCategoryId) {
      const category = await prisma.category.findFirst({
        where: { id: normalizedCategoryId, userId },
      });
      const invalid = invalidBudgetCategory(category);
      if (invalid) return res.status(invalid.status).json({ error: invalid.error });
    }

    // Senza "attivo da": dall'inizio della finestra corrente del periodo, così il
    // budget conta già la spesa fatta in questo periodo.
    const start = startDate
      ? new Date(startDate)
      : dateOnly(currentBudgetWindow(period, new Date(), await payBoundariesFor(userId, [period])).periodStart);

    const budget = await prisma.budget.create({
      data: {
        name,
        amount,
        categoryId: normalizedCategoryId,
        period,
        rollover: rollover ?? 'NONE',
        startDate: start,
        endDate: endDate ? new Date(endDate) : null,
        userId,
      },
      include: { category: true },
    });

    analyticsCache.delPattern(`budget-suggestions:${userId}`);
    res.status(201).json(budget);
  } catch (error) {
    console.error('Create budget error:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
};

// Aggiorna un budget
export const updateBudget = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { name, amount, categoryId, period, startDate, endDate, rollover } = req.body;

    const existingBudget = await prisma.budget.findFirst({
      where: { id, userId },
    });

    if (!existingBudget) {
      return res.status(404).json({ error: 'Budget non trovato' });
    }

    if (amount !== undefined && amount <= 0) {
      return res.status(400).json({ error: 'Importo non valido' });
    }

    if (rollover !== undefined && !['NONE', 'SURPLUS', 'FULL'].includes(rollover)) {
      return res.status(400).json({ error: 'Modalità di riporto non valida' });
    }

    // categoryId: undefined → non toccare; '' → budget complessivo (null); id → valida.
    // Senza la normalizzazione '' finirebbe come foreign key vuota → P2003 → 500.
    const normalizedCategoryId =
      categoryId === undefined
        ? undefined
        : typeof categoryId === 'string' && categoryId.trim() !== ''
          ? categoryId
          : null;

    // Valida la categoria solo se cambia: un budget legacy si può comunque rinominare.
    if (normalizedCategoryId && normalizedCategoryId !== existingBudget.categoryId) {
      const category = await prisma.category.findFirst({
        where: { id: normalizedCategoryId, userId },
      });
      const invalid = invalidBudgetCategory(category);
      if (invalid) return res.status(invalid.status).json({ error: invalid.error });
    }

    const budget = await prisma.budget.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(amount !== undefined && { amount }),
        ...(normalizedCategoryId !== undefined && { categoryId: normalizedCategoryId }),
        ...(period && { period }),
        ...(rollover !== undefined && { rollover }),
        ...(startDate && { startDate: new Date(startDate) }),
        ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
      },
      include: { category: true },
    });

    analyticsCache.delPattern(`budget-suggestions:${userId}`);
    res.json(budget);
  } catch (error) {
    console.error('Update budget error:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
};

// Elimina un budget
export const deleteBudget = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const budget = await prisma.budget.findFirst({
      where: { id, userId },
    });

    if (!budget) {
      return res.status(404).json({ error: 'Budget non trovato' });
    }

    await prisma.budget.delete({ where: { id } });
    analyticsCache.delPattern(`budget-suggestions:${userId}`);

    res.json({ message: 'Budget eliminato con successo' });
  } catch (error) {
    console.error('Delete budget error:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
};

// ── Proposte intelligenti ───────────────────────────────────────────────────
//   Il calcolo vive in utils/budgetPlan.ts (stessa logica di Proiezione e Analisi:
//   competenza, periodo di paga, ritmo quotidiano). Qui: parametri, cache e
//   risparmio (derivato a runtime, così lo slider non invalida la cache).

// GET /budgets/suggestions?period=pay|month&offset=0|1&savingRate=&accountIds=<csv>
export const getBudgetSuggestions = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

    // Override effimero dello slider (anteprima); altrimenti la preferenza salvata.
    let overrideRate: number | undefined;
    const raw = req.query.savingRate;
    if (typeof raw === 'string' && raw !== '') {
      const v = Number(raw);
      if (Number.isFinite(v) && v >= 0 && v <= 0.9) overrideRate = v;
    }

    const mode = req.query.period === 'month' ? 'month' : 'pay';
    // offset: 0 = periodo corrente, 1 = successivo (monthOffset accettato per compatibilità).
    const offset = req.query.offset === '1' || req.query.monthOffset === '1' ? 1 : 0;

    // Conti BANK selezionati: CSV o array ripetuto, validati come conti BANK attivi
    // dell'utente; gli id ignoti vengono scartati. Nessuno valido → nessun filtro.
    const rawAccts = req.query.accountIds;
    const requested = Array.isArray(rawAccts)
      ? (rawAccts as string[])
      : typeof rawAccts === 'string' && rawAccts !== ''
        ? rawAccts.split(',')
        : [];
    let accountIds: string[] | undefined;
    if (requested.length > 0) {
      const bankAccounts = await prisma.account.findMany({
        where: { userId, type: 'BANK', archivedAt: null, id: { in: requested } },
        select: { id: true },
      });
      const valid = bankAccounts.map((a) => a.id);
      if (valid.length > 0) accountIds = valid;
    }

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { savingRate: true } });
    const savingRate = overrideRate ?? Number(user?.savingRate ?? 0);

    const suffix = `${mode}_o${offset}${accountIds ? `_a${[...accountIds].sort().join('-')}` : ''}`;
    const cacheKey = analyticsCache.keys.budgetSuggestions(userId, suffix);
    let plan = analyticsCache.get<BudgetPlan>(cacheKey);
    if (!plan) {
      plan = await computeBudgetPlan(userId, { mode, offset, accountIds });
      analyticsCache.set(cacheKey, plan);
    }

    // Risparmio, ritmo e tetti scalati dipendono dallo slider: calcolati qui, fuori cache.
    const { savingTarget, spendable } = applySaving(plan.disposable, plan.expectedIncome, savingRate);
    res.json({
      ...plan,
      savingRate,
      savingTarget,
      spendable,
      ...planPace(plan, spendable),
      ...scaleCaps(plan.perCategory, spendable),
    });
  } catch (error) {
    console.error('Get budget suggestions error:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
};

// POST /budgets/apply-suggestions
//   body: { items: [{ categoryId, amount }], period: 'PAY_PERIOD'|'MONTHLY', offset?: 0|1 }
// offset 0 → periodo in corso: aggiorna il budget attivo della categoria (o lo crea),
//   ancorato all'inizio della finestra corrente (mai "adesso").
// offset 1 → dal periodo successivo, senza toccare il budget in corso: chiude quello
//   attivo alla vigilia e aggiorna il budget futuro se c'è, altrimenti ne crea uno.
// Un'unica $transaction a batch, letture fatte prima (niente query per riga: P2028).
export const applyBudgetSuggestions = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { items, period: rawPeriod, offset: rawOffset } = (req.body || {}) as {
      items?: Array<{ categoryId?: unknown; amount?: unknown }>;
      period?: unknown;
      offset?: unknown;
    };
    // Periodo dei budget proposti: quello delle proposte (periodo di paga o mese).
    const period: BudgetPeriod = rawPeriod === 'PAY_PERIOD' ? 'PAY_PERIOD' : 'MONTHLY';
    const offset = rawOffset === 1 || rawOffset === '1' ? 1 : 0;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Nessun budget da applicare' });
    }

    // Dedup per categoria (ultimo vince) + validazione
    const byCat = new Map<string, number>();
    for (const it of items) {
      if (!it || typeof it.categoryId !== 'string' || typeof it.amount !== 'number' || !Number.isFinite(it.amount) || it.amount <= 0) {
        return res.status(400).json({ error: 'Dati non validi' });
      }
      byCat.set(it.categoryId, it.amount);
    }

    const categoryIds = Array.from(byCat.keys());
    const categories = await prisma.category.findMany({
      where: { id: { in: categoryIds }, userId },
      select: { id: true, name: true, type: true, isSystem: true },
    });
    if (categories.length !== categoryIds.length) {
      return res.status(404).json({ error: 'Categoria non trovata' });
    }
    for (const c of categories) {
      const invalid = invalidBudgetCategory(c);
      if (invalid) return res.status(invalid.status).json({ error: invalid.error });
    }
    const catName = new Map(categories.map((c) => [c.id, c.name]));

    const now = new Date();
    const pay = await payBoundariesFor(userId, [period]);
    const current = currentBudgetWindow(period, now, pay);
    const target = offset === 1 ? budgetWindowFor(addDays(current.periodEnd, 1), period, pay) : current;
    const targetStart = dateOnly(target.periodStart);
    const eve = dateOnly(addDays(target.periodStart, -1));

    // Budget non scaduti delle categorie e delle loro sotto-categorie (overlap): una lettura.
    const budgets = await prisma.budget.findMany({
      where: {
        userId,
        OR: [{ endDate: null }, { endDate: { gte: startOfLocalDay(now) } }],
        category: { OR: [{ id: { in: categoryIds } }, { parentId: { in: categoryIds } }] },
      },
      select: {
        id: true, name: true, amount: true, categoryId: true, period: true, rollover: true,
        startDate: true, endDate: true, category: { select: { parentId: true } },
      },
      orderBy: { startDate: 'asc' },
    });

    const ops: Prisma.PrismaPromise<unknown>[] = [];
    let created = 0;
    let updated = 0;
    const periodChanged: Array<{ categoryId: string; name: string; from: BudgetPeriod; to: BudgetPeriod }> = [];
    const rolloverReset: Array<{ categoryId: string; name: string }> = [];
    const overlaps: Array<{ categoryId: string; name: string; childBudgets: Array<{ id: string; name: string; amount: number }> }> = [];

    for (const categoryId of categoryIds) {
      const amount = byCat.get(categoryId)!;
      const name = catName.get(categoryId)!;
      const own = budgets.filter((b) => b.categoryId === categoryId);
      const active = own.find((b) => budgetStatus(b, now) === 'active');
      const upcoming = own.find((b) => budgetStatus(b, now) === 'upcoming');

      // La proposta macro comprende già la spesa delle sotto-categorie con budget.
      const children = budgets.filter((b) => b.category?.parentId === categoryId && budgetStatus(b, now) === 'active');
      if (children.length > 0) {
        overlaps.push({ categoryId, name, childBudgets: children.map((b) => ({ id: b.id, name: b.name, amount: Number(b.amount) })) });
      }

      // Cambio periodo: il riporto accumulato cambierebbe finestre → si azzera.
      const base = offset === 1 ? (upcoming ?? active) : (active ?? upcoming);
      let rollover = base?.rollover ?? 'NONE';
      if (base && base.period !== period) {
        periodChanged.push({ categoryId, name, from: base.period, to: period });
        if (rollover !== 'NONE') {
          rollover = 'NONE';
          rolloverReset.push({ categoryId, name });
        }
      }

      if (offset === 0) {
        if (active) {
          // Ancorato all'inizio della finestra, senza accorciare lo storico.
          const startDate = active.startDate < targetStart ? active.startDate : targetStart;
          ops.push(prisma.budget.update({ where: { id: active.id }, data: { amount, period, rollover, startDate } }));
          updated++;
        } else if (upcoming) {
          // Solo un budget futuro: lo anticipo all'inizio della finestra invece di sovrapporne un secondo.
          ops.push(prisma.budget.update({
            where: { id: upcoming.id },
            data: { amount, period, rollover, startDate: targetStart },
          }));
          updated++;
        } else {
          ops.push(prisma.budget.create({
            data: { name, amount, categoryId, period, rollover: 'NONE', startDate: targetStart, userId },
          }));
          created++;
        }
        continue;
      }

      // offset 1: il budget in corso resta com'è fino alla vigilia del periodo successivo.
      if (active && (!active.endDate || active.endDate > eve)) {
        ops.push(prisma.budget.update({ where: { id: active.id }, data: { endDate: eve } }));
      }
      if (upcoming) {
        ops.push(prisma.budget.update({
          where: { id: upcoming.id },
          data: { amount, period, rollover, startDate: targetStart },
        }));
        updated++;
      } else {
        ops.push(prisma.budget.create({
          data: { name: active?.name ?? name, amount, categoryId, period, rollover, startDate: targetStart, userId },
        }));
        created++;
      }
    }

    await prisma.$transaction(ops);
    analyticsCache.delPattern(`budget-suggestions:${userId}`);

    res.status(200).json({
      applied: categoryIds.length,
      created,
      updated,
      scheduled: offset === 1 ? categoryIds.length : 0,
      periodChanged,
      rolloverReset,
      overlaps,
    });
  } catch (error) {
    console.error('Apply budget suggestions error:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
};
