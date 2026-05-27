# Sincronizzazione cross-tab con BroadcastChannel

## Il problema di partenza

Finance Tracker è una Single Page Application (SPA) che usa **React Query** per gestire i dati ricevuti dal server. React Query mantiene una **cache locale** — una copia in memoria dei dati già scaricati — per evitare di rifetcharli ogni volta che l'utente naviga tra le pagine.

Tutto funziona perfettamente quando l'utente usa **una sola scheda del browser**. Il problema emerge quando ne apre **due o più**.

### Perché due tab non si "parlano"

Ogni tab del browser è un processo JavaScript **completamente isolato**. Ha il suo stack di memoria, le sue variabili, il suo React Query con la sua cache. Non esiste nessun canale di comunicazione automatico tra loro.

```
┌─────────────────────────────────────────────┐
│                  BROWSER                   │
│                                             │
│  ┌──────────────────┐  ┌──────────────────┐ │
│  │     TAB A        │  │     TAB B        │ │
│  │  Transazioni     │  │   Dashboard      │ │
│  │                  │  │                  │ │
│  │  React Query     │  │  React Query     │ │
│  │  Cache: {        │  │  Cache: {        │ │
│  │   transactions,  │  │   dashboard,     │ │
│  │   dashboard, ... │  │   summary, ...   │ │
│  │  }               │  │  }               │ │
│  │                  │  │                  │ │
│  │  🔒 ISOLATA      │  │  🔒 ISOLATA      │ │
│  └──────────────────┘  └──────────────────┘ │
│                                             │
│         ❌ Nessuna comunicazione            │
└─────────────────────────────────────────────┘
```

---

## Il comportamento vecchio

Con la vecchia implementazione, le mutation (create, update, delete) invalidavano solo la cache **del tab corrente**. 
Gli altri tab rimanevano con dati obsoleti finché l'utente non triggherava
un aggiornamento manuale (ricaricando la pagina o smontando/rimontando il componente).

### Scenario: creo una transazione con due tab aperti

```
VECCHIO COMPORTAMENTO
─────────────────────────────────────────────────────────────────────

TAB A — Transazioni                    TAB B — Dashboard
────────────────────                   ─────────────────

[1] Utente crea una nuova
    transazione da €150

[2] POST /api/transactions
    → Server salva nel DB

[3] onSuccess() scatta:
    invalidateQueries(['transactions'])  ──┐
    invalidateQueries(['dashboard'])     ──┤  Solo nella cache di Tab A
    invalidateQueries(['budgets'])       ──┘

[4] Tab A rifetcha i dati
    Lista transazioni aggiornata ✓       [4] Tab B non sa nulla
                                             Cache ['dashboard'] ancora
                                             con il saldo VECCHIO ❌

                                         [5] L'utente guarda il saldo:
                                             mostra €X invece di €X+150

                                         [6] Solo dopo:
                                             - ricarica la pagina
                                             - cambia tab e torna
                                             - aspetta 5 minuti (gcTime)
                                             → saldo finalmente aggiornato
```

Il problema non era nel codice delle mutation — era architetturale: non esisteva nessun meccanismo per far sapere agli altri tab che qualcosa era cambiato.

---

## La soluzione: BroadcastChannel API

**BroadcastChannel** è una API nativa del browser (nessuna libreria necessaria) che permette a più tab/window della **stessa origine** di scambiarsi messaggi in tempo reale.

```
┌─────────────────────────────────────────────────────────┐
│                      BROWSER                            │
│                                                         │
│  ┌──────────────┐    📡 'finance-sync'   ┌────────────┐ │
│  │    TAB A     │ ──── postMessage() ──► │   TAB B    │ │
│  │              │ ◄──── onmessage() ──── │            │ │
│  └──────────────┘                        └────────────┘ │
│         ▲                                      ▲        │
│         │                                      │        │
│  ┌──────────────┐                        ┌────────────┐ │
│  │    TAB C     │ ◄──── onmessage() ──── │   TAB N    │ │
│  └──────────────┘                        └────────────┘ │
│                                                         │
│  Tutti i tab connessi allo stesso canale 'finance-sync' │
└─────────────────────────────────────────────────────────┘
```

### Proprietà fondamentali

| Proprietà | Valore | Impatto |
|-----------|--------|---------|
| **Stesso mittente** | Il tab che manda NON riceve il proprio messaggio | Nessun doppio refetch |
| **Stessa origine** | Funziona solo tra tab con stesso dominio+porta | Sicuro by design |
| **Sincrono** | Il messaggio arriva quasi istantaneamente | Aggiornamento immediato |
| **Nativo** | Nessuna dipendenza, zero bundle size aggiunto | Leggero |
| **Fallback** | Se non supportato, `new BroadcastChannel()` lancia eccezione | Gestito con try/catch |

---

## Il nuovo comportamento

Con BroadcastChannel integrato nelle mutation di React Query, ogni operazione che modifica i dati notifica automaticamente tutti gli altri tab aperti.

### Scenario: creo una transazione con due tab aperti

```
NUOVO COMPORTAMENTO
─────────────────────────────────────────────────────────────────────

TAB A — Transazioni                    TAB B — Dashboard
────────────────────                   ─────────────────

[1] Utente crea una nuova
    transazione da €150

[2] POST /api/transactions
    → Server salva nel DB

[3] onSuccess() scatta:
    ┌─ Invalidazione locale ──────────┐
    │ invalidateQueries(['transactions'])
    │ invalidateQueries(['dashboard'])
    │ invalidateQueries(['budgets'])
    │ invalidateQueries(['calendar'])
    └────────────────────────────────┘

    ┌─ Broadcast ─────────────────────┐
    │ broadcastInvalidation(          │──────────────────────►  📡
    │   ['transactions','dashboard',  │                     ch.onmessage riceve
    │    'budgets','calendar']        │                     ['transactions',
    │ )                               │                      'dashboard', ...]
    └────────────────────────────────┘
                                                             [4] invalidateQueries
                                                                 per ogni key
                                                                 ricevuta

[4] Tab A rifetcha:                    [5] Tab B rifetcha:
    Lista transazioni ✓                    Saldo aggiornato ✓
    Dashboard aggiornata ✓                 Grafico trend ✓
                                           Transazioni recenti ✓

    Tutto in tempo reale, senza che l'utente faccia nulla. ✅
```

---

## Architettura dell'implementazione

Il sistema è composto da tre livelli.

```
┌─────────────────────────────────────────────────────────────┐
│  LIVELLO 3 — Mutation Hooks                                 │
│  useCreateTransaction, useDeletePlanned, useCreateRecurring │
│  ...ogni hook che modifica dati                             │
│                                                             │
│  onSuccess() {                                              │
│    invalidateTransactions(queryClient)  ← invalida locale   │
│    // dentro c'è anche broadcastInvalidation()              │
│  }                                                          │
└────────────────────────┬────────────────────────────────────┘
                         │ chiama
┌────────────────────────▼────────────────────────────────────┐
│  LIVELLO 2 — utils/syncChannel.ts                           │
│                                                             │
│  broadcastInvalidation(keys: string[])                      │
│    → channel.postMessage(keys)          ← manda agli altri  │
│                                                             │
│  setupCrossTabSync(queryClient)                             │
│    → channel.onmessage = invalidate     ← ascolta dagli altri│
└────────────────────────┬────────────────────────────────────┘
                         │ usa
┌────────────────────────▼────────────────────────────────────┐
│  LIVELLO 1 — BroadcastChannel (API nativa browser)          │
│                                                             │
│  new BroadcastChannel('finance-sync')                       │
│  channel.postMessage(payload)                               │
│  channel.addEventListener('message', handler)               │
└─────────────────────────────────────────────────────────────┘
```

---

## Il codice, spiegato riga per riga

### `utils/syncChannel.ts` — il cuore del sistema

```typescript
import type { QueryClient } from '@tanstack/react-query';

const CHANNEL_NAME = 'finance-sync';

// Singleton: un solo canale per tab, creato una volta sola e riusato.
// Se si creasse un nuovo BroadcastChannel ad ogni messaggio, ci sarebbe
// overhead inutile e rischio di listener orfani.
let _channel: BroadcastChannel | null = null;

function getChannel(): BroadcastChannel | null {
  if (_channel) return _channel;       // già creato → restituisce quello esistente
  try {
    _channel = new BroadcastChannel(CHANNEL_NAME);
    return _channel;
  } catch {
    // BroadcastChannel non disponibile (es. SSR, browser molto vecchi)
    // → ritorna null e l'app continua a funzionare normalmente
    return null;
  }
}

/**
 * Chiamato dagli hook mutation dopo ogni operazione che modifica dati.
 * Invia l'array di query key agli altri tab, che le invalideranno.
 *
 * IMPORTANTE: il tab mittente NON riceve il proprio messaggio.
 * Questo è garantito dalla spec di BroadcastChannel — nessun doppio refetch.
 */
export function broadcastInvalidation(keys: string[]): void {
  getChannel()?.postMessage(keys);
  //           ^ optional chaining: se getChannel() ritorna null, non fa nulla
}

/**
 * Chiamato UNA SOLA VOLTA in main.tsx all'avvio dell'app.
 * Mette in ascolto il canale: quando arriva un messaggio dagli altri tab,
 * invalida le corrispondenti query nella cache locale.
 *
 * Ritorna una funzione di cleanup (buona pratica, anche se il tab
 * raramente viene "smontato" senza ricaricare la pagina).
 */
export function setupCrossTabSync(queryClient: QueryClient): () => void {
  const ch = getChannel();
  if (!ch) return () => {};            // nessun BroadcastChannel → noop

  const handler = ({ data }: MessageEvent<string[]>) => {
    if (!Array.isArray(data)) return;  // guard contro messaggi malformati
    data.forEach((key) =>
      queryClient.invalidateQueries({ queryKey: [key] })
    );
    // Nota: questo invalida le query locali del tab ricevente.
    // Se la query è montata (componente visibile), React Query
    // lancia immediatamente un refetch in background.
  };

  ch.addEventListener('message', handler);
  return () => ch.removeEventListener('message', handler);
}
```

---

### `main.tsx` — avvio del listener

```typescript
import { setupCrossTabSync } from './utils/syncChannel';

const queryClient = new QueryClient({ ... });

// Avvia il listener UNA VOLTA, prima del render dell'app.
// Da questo momento, ogni messaggio BroadcastChannel dagli altri tab
// causerà l'invalidazione della cache locale.
setupCrossTabSync(queryClient);

createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>
);
```

---

### Mutation hook — pattern prima e dopo

I mutation hook seguono tutti lo stesso pattern. Prendiamo `useCreateTransaction` come esempio.

**Prima:**
```typescript
export const useCreateTransaction = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => transactionAPI.create(data),
    onSuccess: () => {
      // Invalida solo la cache di questo tab
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      queryClient.invalidateQueries({ queryKey: ['calendar'] });
      // ← Gli altri tab non sanno nulla
    },
  });
};
```

**Dopo:**
```typescript
// Le chiavi da invalidare sono dichiarate una sola volta come costante
const TRANSACTION_KEYS = ['transactions', 'dashboard', 'budgets', 'calendar'];

// Funzione helper: invalida localmente E notifica gli altri tab
const invalidateTransactions = (queryClient) => {
  TRANSACTION_KEYS.forEach((k) =>
    queryClient.invalidateQueries({ queryKey: [k] })
  );
  broadcastInvalidation(TRANSACTION_KEYS);  // ← la nuova riga
};

export const useCreateTransaction = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => transactionAPI.create(data),
    onSuccess: () => invalidateTransactions(queryClient),
  });
};
```

Il refactoring porta due vantaggi oltre alla sincronizzazione: le chiavi di invalidazione
sono definite in un unico posto (se domani aggiungi una nuova dipendenza, la cambi lì),
e ogni hook diventa più leggibile.

---

### Mappa completa: chi invalida cosa

```
MUTATION                        QUERY KEY INVALIDATE E BROADCAST
──────────────────────────────────────────────────────────────────
Crea/Modifica/Elimina           transactions
transazione                     dashboard
                                budgets
                                calendar

Crea/Modifica/Elimina           recurring
ricorrente, toggle attivo       dashboard
                                pending-recurring
                                calendar

Esegui ricorrente               transactions
(batch o singola)               dashboard
                                recurring
                                recurring-due
                                pending-recurring
                                calendar

Crea/Modifica/Elimina           planned
pianificata                     dashboard
                                pending-planned
                                calendar

Segna pianificata come pagata   planned
                                transactions
                                dashboard
                                pending-planned
                                calendar

Crea/Modifica/Elimina budget    budgets
                                dashboard

Crea/Modifica categoria         categories

Elimina categoria               categories
                                transactions
                                dashboard
```

---

## Confronto diretto: vecchia vs nuova implementazione

```
┌─────────────────────┬──────────────────────────┬──────────────────────────┐
│ Caratteristica      │ Vecchia implementazione   │ Nuova implementazione    │
├─────────────────────┼──────────────────────────┼──────────────────────────┤
│ Aggiornamento       │ Solo tab corrente         │ Tutti i tab aperti       │
│ cross-tab           │                           │                          │
├─────────────────────┼──────────────────────────┼──────────────────────────┤
│ Latenza             │ Manuale (ricarica pagina) │ < 10ms (quasi istantaneo)│
├─────────────────────┼──────────────────────────┼──────────────────────────┤
│ Richieste di rete   │ 0 extra                   │ 0 extra sul canale;      │
│ aggiuntive          │                           │ solo i refetch necessari │
├─────────────────────┼──────────────────────────┼──────────────────────────┤
│ Trigger             │ Solo mutation locali       │ Mutation su qualsiasi tab│
├─────────────────────┼──────────────────────────┼──────────────────────────┤
│ Dipendenze esterne  │ Nessuna                   │ Nessuna (API nativa)     │
├─────────────────────┼──────────────────────────┼──────────────────────────┤
│ Bundle size         │ –                         │ +0 bytes                 │
├─────────────────────┼──────────────────────────┼──────────────────────────┤
│ Supporto browser    │ –                         │ Chrome 54+, Firefox 38+, │
│                     │                           │ Safari 15.4+             │
├─────────────────────┼──────────────────────────┼──────────────────────────┤
│ Fallback            │ –                         │ Sì: se non supportato,   │
│                     │                           │ funziona come prima      │
├─────────────────────┼──────────────────────────┼──────────────────────────┤
│ Polling             │ No                        │ No                       │
├─────────────────────┼──────────────────────────┼──────────────────────────┤
│ Infrastruttura      │ Nessuna                   │ Nessuna                  │
│ backend             │ necessaria                │ necessaria               │
└─────────────────────┴──────────────────────────┴──────────────────────────┘
```

---

## Dettagli tecnici importanti

### 1. Il mittente non riceve il proprio messaggio

Questa è una garanzia della spec di BroadcastChannel, non un comportamento accidentale.
Significa che quando Tab A fa `postMessage(keys)`:

```
Tab A → broadcast → Tab B riceve ✓
                  → Tab C riceve ✓
                  → Tab A NON riceve ✗  (by design)
```

Senza questa garanzia, Tab A invaliderebbe le proprie query due volte: una volta direttamente
nell'`onSuccess` e una seconda volta ricevendo il proprio broadcast. React Query gestirebbe
ugualmente la situazione (le invalidazioni sono idempotenti), ma ci sarebbe un refetch inutile.

### 2. Il canale è un singleton per tab

```typescript
let _channel: BroadcastChannel | null = null;   // variabile di modulo

function getChannel() {
  if (_channel) return _channel;   // stesso oggetto per tutta la vita del tab
  _channel = new BroadcastChannel('finance-sync');
  return _channel;
}
```

Aprire e chiudere un `BroadcastChannel` ad ogni messaggio è inutilmente costoso.
Il canale viene creato una volta al primo uso e riusato per tutte le comunicazioni successive.

### 3. L'invalidazione è filtrata per query attive

Quando Tab B riceve il messaggio e chiama `invalidateQueries()`, React Query non fa fetch
ciecamente per tutto: rifetcha solo le query che in quel momento hanno **subscriber attivi**,
cioè componenti montati che stanno guardando quei dati.

```
Tab B aperto su Dashboard:
  → ['dashboard'] ha subscriber attivi → refetch immediato ✓
  → ['transactions'] non ha subscriber → marcato stale, refetcha al prossimo mount

Tab B aperto su Transazioni:
  → ['transactions'] ha subscriber attivi → refetch immediato ✓
  → ['dashboard'] non ha subscriber → marcato stale, refetcha al prossimo mount
```

Questo rende il sistema efficiente: non vengono mai fatte richieste di rete per dati
che nessuno sta guardando in quel momento.

### 4. Compatibilità e fallback

`BroadcastChannel` è supportato da tutti i browser moderni. In caso non lo fosse
(ambienti SSR, browser molto vecchi, o alcuni ambienti di test), `new BroadcastChannel()`
lancia un'eccezione. Il `try/catch` in `getChannel()` cattura silenziosamente l'errore
e ritorna `null`. Tutte le funzioni che usano `getChannel()` gestiscono il `null`
con optional chaining (`?.`) o early return, quindi l'app continua a funzionare
esattamente come prima — senza sincronizzazione cross-tab, ma senza crash.

---

## Quando usare BroadcastChannel (e quando no)

### ✅ Adatto per

- App single-user con più tab aperti della stessa sessione
- Sincronizzazione della cache lato client (come in questo caso)
- Notifiche cross-tab leggere (es. "logout effettuato, chiudi gli altri tab")
- Coordinamento di lock o stati globali tra tab

### ❌ Non adatto per

- Sincronizzazione tra **utenti diversi** (serve WebSocket o SSE lato server)
- Comunicazione tra **origini diverse** (BroadcastChannel funziona solo same-origin)
- Dati che devono persistere (BroadcastChannel è solo in-memory, non sopravvive
  alla chiusura del tab)
- Ambienti **server-side rendering** puri (nessun `window` disponibile)

---

## Alternativa considerata e scartata: `refetchOnWindowFocus`

React Query offre un'opzione `refetchOnWindowFocus` che, se abilitata, rifetcha
le query stale ogni volta che il tab torna in primo piano (evento `visibilitychange`).

```typescript
// Nell'implementazione attuale è disabilitato globalmente
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,  // ← disabilitato
    },
  },
});
```

Perché è disabilitato e perché BroadcastChannel è meglio:

```
refetchOnWindowFocus: true               BroadcastChannel
────────────────────────────────────     ────────────────────────────────────
Rifetcha ogni volta che porti            Rifetcha solo quando una mutation
il tab in primo piano, anche se          ha effettivamente cambiato i dati.
nessuno ha modificato nulla.
                                         → Zero refetch inutili
→ Refetch inutili se l'utente
  alterna tra tab senza fare nulla.

Non funziona se entrambi i tab           Funziona anche con entrambi i tab
sono visibili contemporaneamente         visibili (split screen): il messaggio
(split screen): nessun evento            arriva comunque via canale.
visibilitychange scatta.

Latenza: dipende da quando               Latenza: < 10ms dopo l'onSuccess
l'utente porta il tab in focus.          della mutation.
```

---

*Documento generato il 2026-05-27 — Finance Tracker v1.x*
