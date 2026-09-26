import NodeCache from 'node-cache';

const cache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

// Invalida tutte le varianti (per parametri) delle proiezioni dell'utente:
// sia il saldo previsto aggregato sia la serie temporale, che condividono la
// stessa logica sottostante e vanno invalidate insieme.
const delProjections = (uid: string): void => {
  cache.keys()
    .filter(k => k.startsWith(`projected-balance:${uid}:`) || k.startsWith(`projection-series:${uid}:`))
    .forEach(k => cache.del(k));
};

// Il patrimonio storico cambia solo dai movimenti reali (create/update/delete o
// esecuzione di ricorrenti/pianificate, che generano una transazione). Invalida sia
// la serie aggregata sia quella scomposta per conto, che condividono la stessa fonte.
const delNetWorth = (uid: string): void => {
  cache.keys()
    .filter(k => k.startsWith(`networth-series:${uid}:`) || k.startsWith(`networth-by-account:${uid}:`))
    .forEach(k => cache.del(k));
};

// Il trend mensile è cacheato per-orizzonte (suffisso months) → invalida tutte
// le varianti dell'utente con un delete per prefisso.
const delMonthlyTrend = (uid: string): void => {
  cache.keys()
    .filter(k => k.startsWith(`monthly-trend:${uid}:`))
    .forEach(k => cache.del(k));
};

// I suggerimenti budget sono cacheati per-suffisso (mese + insieme di conti
// selezionati) → invalida tutte le varianti dell'utente con un delete per prefisso.
const delBudgetSuggestions = (uid: string): void => {
  cache.keys()
    .filter(k => k.startsWith(`budget-suggestions:${uid}:`))
    .forEach(k => cache.del(k));
};

// Analisi spese: cacheata per modalità/numero di periodi. Dipende da transazioni,
// scadenze, conti, categorie e periodo di paga: si invalida insieme al forecast.
const delSpending = (uid: string): void => {
  cache.keys()
    .filter(k => k.startsWith(`spending:${uid}:`))
    .forEach(k => cache.del(k));
};

export const analyticsCache = {
  get: <T>(key: string): T | undefined => cache.get<T>(key),
  set: <T>(key: string, value: T): void => { cache.set(key, value); },
  delPattern: (prefix: string): void => {
    cache.keys().filter(k => k.startsWith(prefix)).forEach(k => cache.del(k));
  },

  keys: {
    forecast:         (uid: string) => `forecast:${uid}`,
    spending:         (uid: string, suffix: string) => `spending:${uid}:${suffix}`,
    budgetSuggestions:(uid: string, suffix = '') => `budget-suggestions:${uid}:${suffix}`,
    monthlyTrend:     (uid: string, suffix: string) => `monthly-trend:${uid}:${suffix}`,
    projectedBalance: (uid: string, suffix: string) => `projected-balance:${uid}:${suffix}`,
    projectionSeries: (uid: string, suffix: string) => `projection-series:${uid}:${suffix}`,
    netWorthSeries:   (uid: string, suffix: string) => `networth-series:${uid}:${suffix}`,
    netWorthByAccount:(uid: string, suffix: string) => `networth-by-account:${uid}:${suffix}`,
    recurringDue:     (uid: string) => `recurring-due:${uid}`,
    plannedDue:       (uid: string) => `planned-due:${uid}`,
    installmentsDue:  (uid: string) => `installments-due:${uid}`,
  },

  // Invalidazioni raggruppate per tipo di evento

  // Una transazione è cambiata (create/update/delete)
  onTransactionMutated: (uid: string) => {
    cache.del(`forecast:${uid}`);
    delSpending(uid);
    delBudgetSuggestions(uid);
    delMonthlyTrend(uid);
    delProjections(uid);
    delNetWorth(uid);
  },

  // Una ricorrente è cambiata (create/update/delete/toggle)
  onRecurringMutated: (uid: string) => {
    cache.del(`forecast:${uid}`);
    delSpending(uid);
    cache.del(`recurring-due:${uid}`);
    delBudgetSuggestions(uid);
    delProjections(uid);
  },

  // Una ricorrente è stata eseguita (crea anche una transazione reale)
  onRecurringExecuted: (uid: string) => {
    cache.del(`forecast:${uid}`);
    delSpending(uid);
    delBudgetSuggestions(uid);
    delMonthlyTrend(uid);
    cache.del(`recurring-due:${uid}`);
    delProjections(uid);
    delNetWorth(uid);
  },

  // Una pianificata è cambiata (create/update/delete) — include le rate dei piani
  onPlannedMutated: (uid: string) => {
    cache.del(`forecast:${uid}`);
    delSpending(uid);
    delBudgetSuggestions(uid);
    cache.del(`planned-due:${uid}`);
    cache.del(`installments-due:${uid}`);
    delProjections(uid);
  },

  // Una pianificata è stata pagata (crea anche una transazione reale)
  onPlannedPaid: (uid: string) => {
    cache.del(`forecast:${uid}`);
    delSpending(uid);
    delBudgetSuggestions(uid);
    delMonthlyTrend(uid);
    cache.del(`planned-due:${uid}`);
    cache.del(`installments-due:${uid}`);
    delProjections(uid);
    delNetWorth(uid);
  },

  // Un conto è cambiato (create/update/delete): nome/colore e composizione sono
  // embeddati nella serie per-conto → invalida le serie patrimonio. Il saldo BANK
  // è anche il cuscinetto dei suggerimenti budget → invalidali. currentBalance
  // della proiezione dipende dallo stesso saldo (globale o per-conto) → invalida anche quella.
  // Trend mensile/per-categoria dipendono da bankAccountScope (solo conti BANK):
  // aggiungere/rimuovere una CC ne cambia il risultato → invalidali anche loro,
  // altrimenti restano in cache col valore pre-modifica fino a 5 minuti (stdTTL),
  // disallineati da getSummary/getCategoryStats (non cachate).
  onAccountMutated: (uid: string) => {
    cache.del(`forecast:${uid}`);
    delSpending(uid);
    delNetWorth(uid);
    delBudgetSuggestions(uid);
    delProjections(uid);
    delMonthlyTrend(uid);
  },

  // Una categoria è cambiata (create/update/delete): nome/colore sono embeddati
  // nel trend per categoria → invalidalo (il delete riassegna le tx a "Senza
  // categoria", cambiando anche gli aggregati).
  // Anche le categorie del ritmo quotidiano (forecast/proiezione) e l'eventuale
  // categoria stipendio (SetNull alla cancellazione) dipendono dalle categorie.
  onCategoryMutated: (uid: string) => {
    cache.del(`forecast:${uid}`);
    delSpending(uid);
    delProjections(uid);
  },

  // Impostazioni del periodo di paga cambiate (categoria stipendio / giorno):
  // cambiano orizzonte "fino allo stipendio" e periodi del ritmo quotidiano.
  onPayPeriodChanged: (uid: string) => {
    delBudgetSuggestions(uid);
    cache.del(`forecast:${uid}`);
    delSpending(uid);
    delProjections(uid);
  },
};
