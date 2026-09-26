import { Response } from 'express';
import prisma from '../utils/prisma';
import { AuthRequest } from '../types';
import { analyticsCache } from '../utils/analyticsCache';
import {
  currentCycleWindow,
  effectiveClosingDay,
  computeCycleDebt,
  ensureOpenCycle,
  syncCyclePlanned,
  cycleLabel,
  nextBillingDate,
  closeConcludedCycles,
} from '../utils/billingCycle';
import { getAccountsWithBalances } from '../utils/balance';

const MAX_FREE_ACCOUNTS = 3;
const MAX_PRO_ACCOUNTS  = 10;

export const getAccounts = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

    // Auto-riparazione: chiude qui i cicli CC già conclusi ma ancora OPEN (es. un
    // ciclo "Fine mese" in un mese da 30 giorni, o l'app non aperta nel giorno di
    // chiusura). Così la lista conti riflette sempre lo stato corretto e il debito
    // di un ciclo concluso diventa subito una pianificata, invece di restare orfano.
    const closedCount = await closeConcludedCycles(userId);
    if (closedCount > 0) {
      // Chiudere un ciclo crea solo PlannedTransaction (nessuna Transaction reale):
      // basta invalidare la cache delle pianificate.
      analyticsCache.onPlannedMutated(userId);
      // Segnala al client che deve rinfrescare le query dipendenti (pianificate,
      // calendario, dashboard): questa GET ha avuto un effetto di scrittura.
      res.setHeader('X-Cycles-Closed', String(closedCount));
    }

    // I conti archiviati restano fuori da liste e selettori; ?includeArchived=true
    // li restituisce (con archivedAt) per chi deve mostrare lo storico.
    const includeArchived = req.query.includeArchived === 'true';
    const accounts = await prisma.account.findMany({
      where: { userId, ...(includeArchived ? {} : { archivedAt: null }) },
      include: {
        _count: { select: { transactions: true } },
        linkedAccount: { select: { id: true, name: true } },
        linkedCC: { select: { id: true, name: true, color: true } },
      },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });

    // Calcola saldi con una sola query groupBy invece di N*2 aggregate.
    // NB: i trasferimenti (transferId) NON vanno esclusi qui: muovono denaro tra
    // conti e devono incidere sul saldo per-conto (coerente con balance.ts). Solo
    // gli aggregati statistici (dashboard/budget/analytics/calendar) li filtrano.
    const accountIds = accounts.map((a) => a.id);
    const totals = await prisma.transaction.groupBy({
      by: ['accountId', 'type'],
      where: { accountId: { in: accountIds } },
      _sum: { amount: true },
    });

    const balanceMap: Record<string, { income: number; expense: number }> = {};
    for (const row of totals) {
      if (!row.accountId) continue;
      if (!balanceMap[row.accountId]) balanceMap[row.accountId] = { income: 0, expense: 0 };
      if (row.type === 'INCOME') balanceMap[row.accountId].income = Number(row._sum.amount ?? 0);
      if (row.type === 'EXPENSE') balanceMap[row.accountId].expense = Number(row._sum.amount ?? 0);
    }

    // Per le CC il saldo è il debito del solo ciclo OPEN corrente (i cicli chiusi
    // sono già diventati pianificate): finestra basata su closingDay.
    const ccDebt: Record<string, number> = {};
    await Promise.all(
      accounts
        .filter((a) => a.type === 'CREDIT_CARD')
        .map(async (a) => {
          const { periodStart, periodEnd } = currentCycleWindow(effectiveClosingDay(a));
          ccDebt[a.id] = await computeCycleDebt(a.id, periodStart, periodEnd);
        }),
    );

    const accountsWithBalance = accounts.map((account) => {
      let balance: number;
      if (account.type === 'CREDIT_CARD') {
        // openingBalance = debito iniziale residuo; debito del ciclo aperto positivo
        balance = -Number(account.openingBalance) - (ccDebt[account.id] ?? 0);
      } else {
        const { income = 0, expense = 0 } = balanceMap[account.id] ?? {};
        balance = Number(account.openingBalance) + income - expense;
      }
      return {
        ...account,
        openingBalance: Number(account.openingBalance),
        creditLimit: account.creditLimit ? Number(account.creditLimit) : null,
        balance,
      };
    });

    res.json(accountsWithBalance);
  } catch (error) {
    console.error('Get accounts error:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
};

export const getAccount = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const account = await prisma.account.findFirst({
      where: { id, userId },
      include: {
        linkedAccount: { select: { id: true, name: true } },
        linkedCC: {
          select: {
            id: true, name: true, color: true, type: true,
            creditLimit: true, billingDay: true, closingDay: true, openingBalance: true,
          },
        },
      },
    });

    if (!account) {
      return res.status(404).json({ error: 'Conto non trovato' });
    }

    // Saldi calcolati centralizzati (stessa logica della lista): mappa id → balance.
    const balances = await getAccountsWithBalances(userId);
    const balanceById = new Map(balances.map((b) => [b.id, b.balance]));

    res.json({
      ...account,
      openingBalance: Number(account.openingBalance),
      creditLimit: account.creditLimit ? Number(account.creditLimit) : null,
      balance: balanceById.get(account.id) ?? 0,
      linkedCC: account.linkedCC.map((cc) => ({
        ...cc,
        openingBalance: Number(cc.openingBalance),
        creditLimit: cc.creditLimit ? Number(cc.creditLimit) : null,
        balance: balanceById.get(cc.id) ?? 0,
      })),
    });
  } catch (error) {
    console.error('Get account error:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
};

export const createAccount = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { name, type, color, icon, openingBalance, creditLimit, billingDay, closingDay, linkedAccountId } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({ error: 'Nome conto obbligatorio' });
    }
    if (!type || (type !== 'BANK' && type !== 'CREDIT_CARD')) {
      return res.status(400).json({ error: 'Tipo non valido (BANK o CREDIT_CARD)' });
    }
    if (type === 'CREDIT_CARD' && billingDay !== undefined) {
      const day = Number(billingDay);
      if (!Number.isInteger(day) || day < 1 || day > 31) {
        return res.status(400).json({ error: 'Giorno di addebito non valido (1–31)' });
      }
    }

    const user  = await prisma.user.findUnique({ where: { id: userId }, select: { isPro: true } });
    const limit = user?.isPro ? MAX_PRO_ACCOUNTS : MAX_FREE_ACCOUNTS;
    // I conti archiviati non contano nel limite del piano.
    const count = await prisma.account.count({ where: { userId, archivedAt: null } });
    if (count >= limit) {
      return res.status(403).json({ error: 'Limite account raggiunto', upgrade: !user?.isPro, limit });
    }

    const existing = await prisma.account.findFirst({ where: { userId, name: name.trim() } });
    if (existing) {
      return res.status(409).json({
        error: existing.archivedAt
          ? 'Esiste un conto archiviato con questo nome: scegline un altro'
          : 'Esiste già un conto con questo nome',
      });
    }

    if (linkedAccountId) {
      const linked = await prisma.account.findFirst({ where: { id: linkedAccountId, userId, archivedAt: null } });
      if (!linked) {
        return res.status(400).json({ error: 'Conto collegato non trovato' });
      }
    }

    const account = await prisma.account.create({
      data: {
        userId,
        name: name.trim(),
        type,
        color: color ?? '#0d9488',
        icon: icon ?? null,
        openingBalance: openingBalance ?? 0,
        creditLimit:  type === 'CREDIT_CARD' && creditLimit  ? creditLimit          : null,
        billingDay:   type === 'CREDIT_CARD' && billingDay   ? Number(billingDay)   : null,
        closingDay:   type === 'CREDIT_CARD' && closingDay   ? Number(closingDay)   : null,
        linkedAccountId: type === 'CREDIT_CARD' && linkedAccountId ? linkedAccountId : null,
      },
    });

    analyticsCache.onAccountMutated(userId);

    res.status(201).json({
      ...account,
      openingBalance: Number(account.openingBalance),
      creditLimit: account.creditLimit ? Number(account.creditLimit) : null,
    });
  } catch (error) {
    console.error('Create account error:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
};

export const updateAccount = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    // openingBalance NON è modificabile: è la configurazione di partenza. Il saldo si
    // cambia solo con transazioni, così resta tracciabile e non manipolabile a forza.
    const { name, color, icon, creditLimit, billingDay, closingDay, linkedAccountId } = req.body;

    const existing = await prisma.account.findFirst({ where: { id, userId } });
    if (!existing) {
      return res.status(404).json({ error: 'Conto non trovato' });
    }

    if (name && name.trim() !== existing.name) {
      const duplicate = await prisma.account.findFirst({
        where: { userId, name: name.trim(), id: { not: id } },
      });
      if (duplicate) {
        return res.status(409).json({
          error: duplicate.archivedAt
            ? 'Esiste un conto archiviato con questo nome: scegline un altro'
            : 'Esiste già un conto con questo nome',
        });
      }
    }

    if (billingDay !== undefined) {
      const day = Number(billingDay);
      if (!Number.isInteger(day) || day < 1 || day > 31) {
        return res.status(400).json({ error: 'Giorno di addebito non valido (1–31)' });
      }
    }

    if (linkedAccountId) {
      const linked = await prisma.account.findFirst({ where: { id: linkedAccountId, userId, archivedAt: null } });
      if (!linked) {
        return res.status(400).json({ error: 'Conto collegato non trovato' });
      }
    }

    const account = await prisma.account.update({
      where: { id },
      data: {
        ...(name && { name: name.trim() }),
        ...(color !== undefined && { color }),
        ...(icon !== undefined && { icon }),
        ...(creditLimit !== undefined && { creditLimit: creditLimit ?? null }),
        ...(billingDay  !== undefined && { billingDay:  billingDay  ? Number(billingDay)  : null }),
        ...(closingDay  !== undefined && { closingDay:  closingDay  ? Number(closingDay)  : null }),
        ...(linkedAccountId !== undefined && { linkedAccountId: linkedAccountId ?? null }),
      },
    });

    analyticsCache.onAccountMutated(userId);

    res.json({
      ...account,
      openingBalance: Number(account.openingBalance),
      creditLimit: account.creditLimit ? Number(account.creditLimit) : null,
    });
  } catch (error) {
    console.error('Update account error:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
};

// Elimina un conto.
//   • Senza alcun movimento collegato → eliminazione definitiva.
//   • Con movimenti → ARCHIVIAZIONE: il conto sparisce da liste e selettori ma le
//     sue transazioni restano collegate, così storico, patrimonio e statistiche non
//     cambiano. Serve saldo a zero (i soldi vanno prima spostati altrove), altrimenti
//     la liquidità conterebbe per sempre un conto che non si vede più.
//     Le scadenze FUTURE (ricorrenti attive, pianificate non pagate, piani a rate
//     attivi) e le carte collegate passano al conto principale: restano impegni
//     reali e devono continuare a comparire in proiezione e calendario.
export const deleteAccount = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const account = await prisma.account.findFirst({ where: { id, userId, archivedAt: null } });
    if (!account) {
      return res.status(404).json({ error: 'Conto non trovato' });
    }
    if (account.isDefault) {
      return res.status(400).json({ error: 'Il conto principale non può essere eliminato' });
    }

    const [txCount, recurringCount, plannedCount, planCount, cycleCount] = await Promise.all([
      prisma.transaction.count({ where: { accountId: id } }),
      prisma.recurringTransaction.count({ where: { accountId: id } }),
      prisma.plannedTransaction.count({ where: { OR: [{ accountId: id }, { ccAccountId: id }] } }),
      prisma.installmentPlan.count({ where: { OR: [{ accountId: id }, { ccAccountId: id }] } }),
      prisma.billingCycle.count({ where: { accountId: id } }),
    ]);

    if (txCount + recurringCount + plannedCount + planCount + cycleCount === 0) {
      await prisma.account.delete({ where: { id } });
      analyticsCache.onAccountMutated(userId);
      return res.json({ archived: false, message: 'Conto eliminato con successo' });
    }

    // ── Archiviazione ──
    const balances = await getAccountsWithBalances(userId);
    const balance = balances.find((b) => b.id === id)?.balance ?? 0;
    if (Math.abs(balance) >= 0.005) {
      return res.status(400).json({
        error: account.type === 'CREDIT_CARD'
          ? 'La carta ha ancora un debito nel ciclo aperto: attendi l\'addebito prima di eliminarla'
          : 'Il conto ha ancora un saldo: spostalo con un trasferimento prima di eliminarlo',
      });
    }
    if (account.type === 'CREDIT_CARD') {
      const pendingCharges = await prisma.plannedTransaction.count({ where: { ccAccountId: id, isPaid: false } });
      if (pendingCharges > 0) {
        return res.status(400).json({ error: 'La carta ha addebiti di cicli chiusi ancora da registrare: registrali prima di eliminarla' });
      }
    }

    const main = await prisma.account.findFirst({ where: { userId, isDefault: true, archivedAt: null } });
    if (!main) {
      return res.status(400).json({ error: 'Imposta un conto principale prima di eliminare questo conto' });
    }

    const moved = await prisma.$transaction(async (tx) => {
      // Anche le ricorrenti in pausa: riattivate, non devono generare movimenti
      // su un conto archiviato.
      const recurring = await tx.recurringTransaction.updateMany({
        where: { accountId: id },
        data: { accountId: main.id },
      });
      const planned = await tx.plannedTransaction.updateMany({
        where: { accountId: id, isPaid: false },
        data: { accountId: main.id },
      });
      const plans = await tx.installmentPlan.updateMany({
        where: { accountId: id, status: 'ACTIVE' },
        data: { accountId: main.id },
      });
      // ccAccountId è riservato (oggi non valorizzato dall'API): scollegalo comunque.
      await tx.installmentPlan.updateMany({
        where: { ccAccountId: id, status: 'ACTIVE' },
        data: { ccAccountId: null },
      });
      const cards = await tx.account.updateMany({
        where: { linkedAccountId: id, archivedAt: null },
        data: { linkedAccountId: main.id },
      });
      await tx.account.update({ where: { id }, data: { archivedAt: new Date(), isDefault: false } });
      return { recurring: recurring.count, planned: planned.count, plans: plans.count, cards: cards.count };
    });

    analyticsCache.onAccountMutated(userId);
    analyticsCache.onPlannedMutated(userId);
    analyticsCache.onRecurringMutated(userId);

    const parts = [
      moved.recurring && `${moved.recurring} ${moved.recurring === 1 ? 'ricorrente' : 'ricorrenti'}`,
      moved.planned && `${moved.planned} ${moved.planned === 1 ? 'pianificata' : 'pianificate'}`,
      moved.plans && `${moved.plans} ${moved.plans === 1 ? 'piano a rate' : 'piani a rate'}`,
      moved.cards && `${moved.cards} ${moved.cards === 1 ? 'carta' : 'carte'}`,
    ].filter(Boolean);
    res.json({
      archived: true,
      moved,
      message: parts.length > 0
        ? `Conto archiviato: lo storico resta. Spostati su ${main.name}: ${parts.join(', ')}`
        : 'Conto archiviato: lo storico delle transazioni resta disponibile',
    });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
};

// Ripristina un conto archiviato (anche come "annulla" di un'eliminazione
// involontaria). Lo storico torna visibile com'era; le scadenze e le carte
// spostate sul conto principale all'archiviazione restano lì (vanno riassegnate
// a mano se serve). Il ripristino rispetta il limite di conti del piano.
export const restoreAccount = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const account = await prisma.account.findFirst({ where: { id, userId, archivedAt: { not: null } } });
    if (!account) {
      return res.status(404).json({ error: 'Conto archiviato non trovato' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { isPro: true } });
    const limit = user?.isPro ? MAX_PRO_ACCOUNTS : MAX_FREE_ACCOUNTS;
    const active = await prisma.account.count({ where: { userId, archivedAt: null } });
    if (active >= limit) {
      return res.status(403).json({ error: `Hai raggiunto il limite di ${limit} conti: archiviane uno prima di ripristinare questo`, limit });
    }

    await prisma.account.update({ where: { id }, data: { archivedAt: null } });
    analyticsCache.onAccountMutated(userId);
    res.json({ message: `${account.name} è di nuovo attivo` });
  } catch (error) {
    console.error('Restore account error:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
};

export const closeBillingCycle = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const account = await prisma.account.findFirst({ where: { id, userId } });
    if (!account) return res.status(404).json({ error: 'Conto non trovato' });
    if (account.type !== 'CREDIT_CARD') return res.status(400).json({ error: 'Solo carte di credito' });
    if (!account.linkedAccountId) return res.status(400).json({ error: 'Nessun conto collegato' });

    const now = new Date();
    const closingDay = effectiveClosingDay(account);
    const current = currentCycleWindow(closingDay, now);

    // Il ciclo da chiudere è quello che si conclude oggi (closingDay) oppure, se
    // chiamato in un altro giorno, il ciclo precedente già concluso.
    const sameDay = (a: Date, b: Date) =>
      a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

    let closeWin = current;
    if (!sameDay(current.periodEnd, now)) {
      const before = new Date(current.periodStart);
      before.setDate(before.getDate() - 1);
      closeWin = currentCycleWindow(closingDay, before);
    }

    // Trova/crea il ciclo da chiudere
    const cycle = await prisma.billingCycle.upsert({
      where: { accountId_periodStart: { accountId: id, periodStart: closeWin.periodStart } },
      update: {},
      create: {
        userId,
        accountId: id,
        periodStart: closeWin.periodStart,
        periodEnd: closeWin.periodEnd,
        status: 'OPEN',
      },
    });

    // Apri sempre il ciclo successivo (idempotente)
    const dayAfter = new Date(closeWin.periodEnd);
    dayAfter.setDate(dayAfter.getDate() + 1);
    dayAfter.setHours(12, 0, 0, 0);
    await ensureOpenCycle(userId, account, dayAfter);

    if (cycle.status === 'CLOSED') {
      // Già chiuso: ricalcola comunque la pianificata per sicurezza
      const debt = await computeCycleDebt(id, closeWin.periodStart, closeWin.periodEnd);
      const synced = await syncCyclePlanned(cycle, account, debt);
      analyticsCache.onPlannedMutated(userId);
      return res.json({ cycled: false, alreadyClosed: true, debtAmount: synced });
    }

    const debt = await computeCycleDebt(id, closeWin.periodStart, closeWin.periodEnd);
    const billingDate = nextBillingDate(account.billingDay ?? 15, closeWin.periodEnd);

    // Marca chiuso, poi crea/collega la pianificata col debito calcolato
    const closed = await prisma.billingCycle.update({
      where: { id: cycle.id },
      data: { status: 'CLOSED', closedAt: now, billingDate },
    });
    const debtAmount = await syncCyclePlanned(closed, account, debt);

    analyticsCache.onTransactionMutated(userId);
    analyticsCache.onPlannedMutated(userId);

    res.status(201).json({
      cycled: debtAmount > 0,
      debtAmount,
      billingDate,
      cycleLabel: cycleLabel(closeWin.periodEnd),
    });
  } catch (error) {
    console.error('Close billing cycle error:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
};

export const setDefaultAccount = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const account = await prisma.account.findFirst({ where: { id, userId, archivedAt: null } });
    if (!account) {
      return res.status(404).json({ error: 'Conto non trovato' });
    }

    await prisma.$transaction([
      prisma.account.updateMany({ where: { userId }, data: { isDefault: false } }),
      prisma.account.update({ where: { id }, data: { isDefault: true } }),
    ]);

    res.json({ message: 'Conto principale aggiornato' });
  } catch (error) {
    console.error('Set default account error:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
};

// Storico dei cicli di fatturazione di una CC. Per il ciclo OPEN il debito è
// calcolato live dalle transazioni; per i cicli CLOSED si usa il valore congelato.
export const getBillingCycles = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const account = await prisma.account.findFirst({ where: { id, userId } });
    if (!account) return res.status(404).json({ error: 'Conto non trovato' });
    if (account.type !== 'CREDIT_CARD') return res.status(400).json({ error: 'Solo carte di credito' });

    // Garantisce l'esistenza del ciclo corrente prima di restituire lo storico
    await ensureOpenCycle(userId, account);

    const cycles = await prisma.billingCycle.findMany({
      where: { accountId: id },
      orderBy: { periodStart: 'desc' },
      include: {
        planned: { select: { id: true, amount: true, isPaid: true, plannedDate: true } },
      },
    });

    const result = await Promise.all(
      cycles.map(async (c) => {
        const debt = c.status === 'OPEN'
          ? await computeCycleDebt(id, c.periodStart, c.periodEnd)
          : Number(c.debtAmount);
        return {
          id: c.id,
          periodStart: c.periodStart,
          periodEnd: c.periodEnd,
          status: c.status,
          closedAt: c.closedAt,
          billingDate: c.billingDate,
          debtAmount: Math.round(debt * 100) / 100,
          planned: c.planned
            ? { ...c.planned, amount: Number(c.planned.amount) }
            : null,
        };
      }),
    );

    res.json(result);
  } catch (error) {
    console.error('Get billing cycles error:', error);
    res.status(500).json({ error: 'Errore del server' });
  }
};
