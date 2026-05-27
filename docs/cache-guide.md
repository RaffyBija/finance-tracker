# Guida alla Cache In-Memory con `node-cache`

## Cos'è una cache?

Una **cache** è uno strato di memoria temporanea che conserva il risultato di operazioni costose (query DB, calcoli pesanti) così che le richieste successive non debbano ricalcolarle da zero.

```
Senza cache:              Con cache:
Client → Server → DB      Client → Server → Cache (hit) → risposta immediata
  100ms   80ms              1ms       0ms
```

---

## `node-cache` — caratteristiche

È una libreria Node.js che implementa un dizionario chiave/valore in memoria RAM del processo. Non richiede servizi esterni (a differenza di Redis).

```ts
import NodeCache from 'node-cache';

const cache = new NodeCache({
  stdTTL: 300,      // secondi di vita default per ogni chiave
  checkperiod: 60,  // ogni quanti secondi fa pulizia automatica delle chiavi scadute
});
```

### Operazioni base

```ts
// Scrivi
cache.set('chiave', { dati: 'qualcosa' });        // usa stdTTL
cache.set('chiave', { dati: 'qualcosa' }, 600);   // TTL personalizzato (secondi)

// Leggi
const valore = cache.get<MioTipo>('chiave');
// → restituisce il valore oppure `undefined` se non esiste o è scaduto

// Cancella (invalidazione manuale)
cache.del('chiave');

// Info
cache.getTtl('chiave');   // millisecondi alla scadenza
cache.keys();             // tutte le chiavi attive
cache.getStats();         // hits, misses, keys count
```

---

## Come funziona il TTL (Time To Live)

Ogni valore ha una "scadenza". Dopo `stdTTL` secondi, la chiave viene marcata come scaduta e il prossimo `get` restituirà `undefined`.

```
t=0s   cache.set('forecast:user1', data)   → chiave creata
t=150s cache.get('forecast:user1')          → ritorna data (ancora valida)
t=300s cache.get('forecast:user1')          → undefined (scaduta)
t=360s checkperiod fa pulizia               → chiave rimossa dalla RAM
```

Il `checkperiod` non influenza quando un valore "scade" logicamente — influenza solo quando viene liberata la memoria fisica.

---

## Pattern di utilizzo: Cache-Aside

Il pattern che usiamo nell'app si chiama **Cache-Aside** (o Lazy Loading):

```ts
export const getForecast = async (req, res) => {
  const cacheKey = `forecast:${userId}`;

  // 1. Controlla la cache
  const cached = cache.get(cacheKey);
  if (cached) return res.json(cached);   // cache HIT → risposta immediata

  // 2. Cache MISS → esegui la query vera
  const result = await calcoloComplesso();

  // 3. Salva in cache per le prossime richieste
  cache.set(cacheKey, result);

  res.json(result);
};
```

**Vantaggi**: semplice, i dati vengono cachati solo se effettivamente richiesti.  
**Svantaggio**: la prima richiesta è sempre lenta (cold start).

---

## Invalidazione della cache

La parte più delicata. Ci sono due strategie:

### 1. TTL passivo (scadenza automatica)
Aspetti semplicemente che il TTL scada. Semplice, ma i dati possono essere "stale" (vecchi) per al massimo `TTL` secondi.

```
Utente aggiunge transazione → cache NON invalidata
→ per i prossimi 5 minuti vede ancora il vecchio forecast
→ dopo 5 minuti TTL scade → prossima richiesta ricalcola
```

Accettabile quando: i dati non devono essere real-time (es. media storica).

### 2. Invalidazione attiva (event-driven)
Quando avviene una mutazione (create/update/delete), svuoti esplicitamente le chiavi interessate.

```ts
// In transaction.controller.ts — dopo ogni create/update/delete:
analyticsCache.invalidateUser(userId);

// Significa: cancella forecast:userId dalla cache
// → la prossima GET /analytics/forecast ricalcolerà da zero
```

Questo garantisce che i dati siano sempre freschi dopo ogni azione dell'utente.

---

## Struttura che abbiamo usato

```ts
// utils/analyticsCache.ts
const cache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

export const analyticsCache = {
  get: <T>(key: string) => cache.get<T>(key),
  set: <T>(key: string, value: T) => cache.set(key, value),
  invalidateUser: (userId: string) => {
    cache.del(`forecast:${userId}`);
    // aggiungere altre chiavi qui quando si espande
  },
  keys: {
    forecast: (userId: string) => `forecast:${userId}`,
  },
};
```

Avvolgere `node-cache` in una propria classe/oggetto ha due vantaggi:
- **Unico punto di modifica**: se domani passi a Redis, cambi solo `analyticsCache.ts`
- **Chiavi centralizzate**: non si rischia di scrivere `"forcast:userId"` per sbaglio in un controller

---

## node-cache vs Redis

| | `node-cache` | Redis |
|---|---|---|
| Setup | Zero — solo `npm install` | Richiede un server separato |
| Persistenza | No — svuotata al riavvio | Sì (opzionale) |
| Multi-processo | No — ogni processo ha la sua cache | Sì — condivisa tra processi |
| Limite RAM | RAM del processo Node | Separata e configurabile |
| Latenza | ~0ms (stesso processo) | ~1-5ms (rete locale) |
| Quando usarla | App single-instance, dati non critici | Produzione, clustering, sessioni |

**Per questa app**: `node-cache` è la scelta giusta. Un solo processo Node, dati non critici (se la cache si svuota al riavvio, la prima richiesta ricalcola e la ripopola).

---

## Dove espandere la cache nell'app

Chiavi da aggiungere in `analyticsCache.invalidateUser()` man mano che si cachano altri endpoint:

```ts
invalidateUser: (userId: string) => {
  cache.del(`forecast:${userId}`);
  cache.del(`monthly-trend:${userId}`);       // dopo GET /dashboard/monthly-trend
  cache.del(`projected-balance:${userId}`);   // dopo GET /dashboard/projected-balance
  cache.del(`recurring-due:${userId}`);       // dopo esecuzione ricorrenti
  cache.del(`planned-due:${userId}`);         // dopo mark-as-paid
}
```

Ogni nuovo endpoint cachato:
1. Aggiunge la propria `key` in `analyticsCache.keys`
2. Fa `cache.get` all'inizio e `cache.set` alla fine del controller
3. Aggiunge la propria chiave in `invalidateUser` nei controller che la modificano

---

## Regola pratica per decidere se cachare

Cachare ha senso quando **tutte** queste condizioni sono vere:

1. La query/calcolo richiede > 20ms o coinvolge più query parallele
2. I dati non devono essere real-time (qualche minuto di stale è accettabile)
3. La stessa query viene chiamata frequentemente dallo stesso utente
4. Sai esattamente quando i dati cambiano (puoi invalidare)

Se non sai quando i dati cambiano → usa solo il TTL passivo con un valore basso (30-60s).
