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
// esecuzione di ricorrenti/pianificate, che generano una transazione).
const delNetWorth = (uid: string): void => {
  cache.keys()
    .filter(k => k.startsWith(`networth-series:${uid}:`))
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
    monthlyTrend:     (uid: string) => `monthly-trend:${uid}`,
    projectedBalance: (uid: string, suffix: string) => `projected-balance:${uid}:${suffix}`,
    projectionSeries: (uid: string, suffix: string) => `projection-series:${uid}:${suffix}`,
    netWorthSeries:   (uid: string, suffix: string) => `networth-series:${uid}:${suffix}`,
    recurringDue:     (uid: string) => `recurring-due:${uid}`,
    plannedDue:       (uid: string) => `planned-due:${uid}`,
  },

  // Invalidazioni raggruppate per tipo di evento

  // Una transazione è cambiata (create/update/delete)
  onTransactionMutated: (uid: string) => {
    cache.del(`forecast:${uid}`);
    cache.del(`monthly-trend:${uid}`);
    delProjections(uid);
    delNetWorth(uid);
  },

  // Una ricorrente è cambiata (create/update/delete/toggle)
  onRecurringMutated: (uid: string) => {
    cache.del(`recurring-due:${uid}`);
    delProjections(uid);
  },

  // Una ricorrente è stata eseguita (crea anche una transazione reale)
  onRecurringExecuted: (uid: string) => {
    cache.del(`forecast:${uid}`);
    cache.del(`monthly-trend:${uid}`);
    cache.del(`recurring-due:${uid}`);
    delProjections(uid);
    delNetWorth(uid);
  },

  // Una pianificata è cambiata (create/update/delete)
  onPlannedMutated: (uid: string) => {
    cache.del(`forecast:${uid}`);
    cache.del(`planned-due:${uid}`);
    delProjections(uid);
  },

  // Una pianificata è stata pagata (crea anche una transazione reale)
  onPlannedPaid: (uid: string) => {
    cache.del(`forecast:${uid}`);
    cache.del(`monthly-trend:${uid}`);
    cache.del(`planned-due:${uid}`);
    delProjections(uid);
    delNetWorth(uid);
  },
};
