# Guida al Code-Splitting con `React.lazy` e i Chunk

> Caso di studio reale: lo split del bundle di Finance Tracker (10 giugno 2026).
> Bundle iniziale **938 kB → 412 kB** (gzip 279 → 132 kB).

---

## 1. Il problema: il bundle monolitico

Quando l'app viene compilata per la produzione, lo strumento di build (qui **Vite**, basato su Rollup) parte dal file di ingresso e segue tutti gli `import` per costruire un **grafo delle dipendenze**. Tutto ciò che è raggiungibile da un `import` statico finisce in un unico file `.js`: il **bundle**.

In Finance Tracker, `App.tsx` importava staticamente **tutte** le ~20 pagine in cima al file:

```ts
import DashboardPage from "./pages/DashboardPage";   // trascina recharts (~380 kB!)
import TransactionsPage from "./pages/TransactionsPage";
import CategoriesPage from "./pages/CategoriesPage";
// ...altre 17 pagine
```

Risultato: **un solo chunk da 938 kB**. Il browser doveva scaricarlo e parsarlo **per intero** prima di mostrare qualunque schermata — anche solo il login. Su mobile e subito dopo un deploy (cache fredda) questo si traduceva in un primo caricamento lento.

```
PRIMA — bundle unico
┌─────────────────────────────────────────────┐
│  index.js  (938 kB)                          │
│  React + Router + Login + Landing +          │
│  Dashboard + recharts + Transactions +       │  ← scaricato TUTTO
│  Budgets + Calendar + Accounts + ...         │     anche per vedere /login
└─────────────────────────────────────────────┘
```

---

## 2. Cos'è un "chunk"

Un **chunk** è semplicemente uno dei file `.js` prodotti dal build quando il bundle viene **spezzato in più pezzi**. Invece di un mega-file, si ottengono tanti file più piccoli che il browser scarica **solo quando servono**.

La domanda chiave è: *come fa il bundler a sapere dove tagliare?*

La risposta: a ogni **import dinamico** `import('...')`. Un import statico è una dipendenza "rigida" (deve esserci subito); un import dinamico è una promessa di "lo carico quando lo chiedo".

```ts
import X from './X';        // STATICO  → X finisce nel chunk del chiamante
const X = () => import('./X'); // DINAMICO → Rollup crea un chunk separato per X
```

`import('./X')` restituisce una **Promise** che si risolve con il modulo. Vite, vedendolo, isola `./X` (e tutto ciò che solo lui usa) in un file a parte.

---

## 3. `React.lazy` + `Suspense`: il ponte verso React

Un componente React non può essere "una Promise". `React.lazy` fa da adattatore: prende una funzione che ritorna `import()` e produce un componente vero, che però **si sospende** (mette in pausa il render) finché il chunk non è arrivato.

```ts
const DashboardPage = React.lazy(() => import('./pages/DashboardPage'));
```

Quando React incontra un componente lazy non ancora caricato, "lancia" la Promise verso l'alto nell'albero finché non trova un **`<Suspense>`**, che mostra il `fallback` nel frattempo.

```tsx
<Suspense fallback={<LoadingSpinner />}>
  <DashboardPage />   {/* mentre scarica il chunk → mostra LoadingSpinner */}
</Suspense>
```

```
Utente clicca "Dashboard"
   │
   ▼
React prova a renderizzare <DashboardPage/> (lazy)
   │  chunk non in cache?
   ├── SÌ → componente "sospende" → <Suspense> mostra il fallback (spinner)
   │         │
   │         ▼  browser scarica DashboardPage-xyz.js
   │         ▼  Promise risolta
   │         ▼  React riprende il render → spinner sparisce, pagina appare
   └── NO (già scaricato) → render immediato
```

> Regola: `React.lazy` produce il componente, `<Suspense>` decide *dove* appare lo spinner durante l'attesa. Senza un `<Suspense>` sopra un componente lazy, React lancia un errore.

---

## 4. Il caso reale: cosa abbiamo cambiato

### 4.1 — Da statico a lazy in `App.tsx`

```ts
// PRIMA
import DashboardPage from "./pages/DashboardPage";

// DOPO
const DashboardPage = lazyWithReload(() => import("./pages/DashboardPage"));
```

**Default vs named export.** `React.lazy` si aspetta un modulo con un `export default`. Le nostre pagine con export nominato vanno "rimappate":

```ts
// BudgetsPage esporta `export function Budgets() {...}`  (named, non default)
const Budgets = lazyWithReload(() =>
  import("./pages/BudgetsPage").then(m => ({ default: m.Budgets }))
);
```

Il `.then(m => ({ default: m.Budgets }))` trasforma `{ Budgets }` in `{ default: Budgets }`, la forma che `lazy` pretende.

### 4.2 — Cosa è rimasto eager (e perché)

Non tutto conviene renderlo lazy. Un chunk separato per la pagina che vedi **per prima** introduce un "waterfall" (scarichi lo shell, poi scopri che ti serve un altro chunk, poi lo scarichi). Per questo:

| Pagina | Strategia | Motivo |
|---|---|---|
| `LoginPage`, `LandingPage` | **eager** | Primo accesso non autenticato: nessuno spinner-waterfall |
| `NotFoundPage` | **eager** | È il fallback della rotta `*`, deve esserci sempre |
| Dashboard, Transazioni, Budget, ... | **lazy** | Pagine pesanti, visitate solo dopo il login |

### 4.3 — Doppio `<Suspense>`: il dettaglio che fa la differenza UX

Abbiamo messo **due** boundary `<Suspense>`, non uno:

```
App.tsx
└─ <Suspense fallback={spinner}>        ← ESTERNO: rotte pubbliche senza Layout
   └─ <Routes>
      └─ rotta protetta → <Layout>
         └─ <ErrorBoundary>
            └─ <Suspense fallback={spinner}>  ← INTERNO: dentro il Layout
               └─ {children}  (la pagina lazy)
```

Perché due? React usa il `<Suspense>` **più vicino** al componente che si sospende.

- Per una pagina **protetta** (dentro `Layout`), il boundary più vicino è quello **interno** → lo spinner appare nell'area contenuto e **la navbar resta montata**. Navighi tra Dashboard e Transazioni senza che la barra in alto sparisca.
- Per una pagina **pubblica** (es. `/register`, senza `Layout`), non c'è il boundary interno → interviene quello **esterno**, full-page.

Con un solo `<Suspense>` esterno, ogni cambio di rotta protetta avrebbe smontato l'intero layout (navbar inclusa) mostrando uno spinner a tutto schermo: brutto e disorientante.

---

## 5. `ChunkLoadError`: il problema dei deploy

C'è un'insidia tipica del code-splitting. I chunk hanno un **hash nel nome** che cambia a ogni build: `DashboardPage-BYbjwNJ2.js`. Dopo un deploy:

```
Tab aperta da stamattina        Server dopo il deploy
chiede: DashboardPage-AAAA.js   ha solo: DashboardPage-BBBB.js
   │                                │
   └────────► 404 ◄────────────────┘
        import() viene RIGETTATO  →  "ChunkLoadError"
```

L'utente vedrebbe una pagina rotta solo perché ha tenuto la tab aperta durante un nostro deploy.

### La soluzione: `lazyWithReload`

Abbiamo incapsulato `React.lazy` in un util che intercetta il fallimento dell'`import()` e forza **un** reload, così il browser riscarica `index.html` con i riferimenti agli hash nuovi:

```ts
export function lazyWithReload<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
) {
  return lazy(async () => {
    try {
      return await factory();
    } catch (err) {
      // Chiave globale per sessione: un solo reload automatico,
      // indipendentemente da quale chunk fallisce (anti-loop).
      const KEY = 'chunk-reload';
      if (!sessionStorage.getItem(KEY)) {
        sessionStorage.setItem(KEY, '1');
        window.location.reload();
        return new Promise<{ default: T }>(() => {}); // non risolve: tiene il fallback
      }
      throw err; // già ritentato una volta → propaga all'ErrorBoundary
    }
  });
}
```

Punti chiave del design:
- **Guardia `sessionStorage`**: senza di essa, se anche dopo il reload il chunk fallisse, si entrerebbe in un **loop di reload infinito**. La chiave garantisce *un solo* tentativo automatico per sessione.
- **Promise che non risolve** (`new Promise(() => {})`): mentre `window.location.reload()` sta ricaricando, restituiamo una Promise eterna così React continua a mostrare lo spinner invece di lampeggiare un errore.
- **`throw err` finale**: se il reload non ha risolto, l'errore arriva all'`ErrorBoundary`, che mostra il fallback "Qualcosa è andato storto / Riprova". Rete di sicurezza, non si nasconde il problema.

---

## 6. Il risultato misurato

Output del `vite build` dopo lo split (estratto):

```
dist/assets/index-DZdLCEFp.js          412.30 kB │ gzip: 132.18 kB   ← shell + React + Login/Landing
dist/assets/DashboardPage-BYbjwNJ2.js  382.74 kB │ gzip: 112.98 kB   ← recharts, solo su /dashboard
dist/assets/RecurringTransactions.js    17.21 kB │ gzip:   5.49 kB
dist/assets/ProfilePage.js              16.60 kB │ gzip:   4.38 kB
dist/assets/TransactionsPage.js         13.11 kB │ gzip:   3.97 kB
dist/assets/CalendarPage.js              6.24 kB │ gzip:   2.29 kB
... (36 chunk totali)
```

Cosa leggere in questi numeri:
- **Chunk iniziale dimezzato** (938 → 412 kB). È ciò che scarichi all'apertura dell'app.
- **recharts isolato**: la libreria dei grafici (~380 kB) vive nel chunk di `DashboardPage`. Chi non apre la dashboard non la scarica mai. Vite l'ha messa lì da solo perché solo quella pagina la usa; se due pagine lazy condividessero una libreria, Vite creerebbe automaticamente un terzo chunk condiviso.
- **Sparito il warning** `chunk > 500 kB`: nessun singolo file supera più la soglia.

```
DOPO — chunk separati
┌──────────────┐   l'utente scarica solo questo all'avvio
│ index (412)  │
└──────────────┘
   poi, on-demand, solo ciò che visita:
   ┌────────────────┐ ┌──────────────┐ ┌──────────────┐
   │ Dashboard(383) │ │ Transac.(13) │ │ Calendar(6)  │  ...
   └────────────────┘ └──────────────┘ └──────────────┘
```

---

## 7. Riepilogo / checklist per la prossima volta

1. **Trova i pesi morti**: librerie grosse usate da poche pagine (grafici, editor, mappe) sono i candidati ideali allo split.
2. **`const X = lazy(() => import('./X'))`** al posto dell'import statico. Named export → `.then(m => ({ default: m.X }))`.
3. **Tieni eager** ciò che serve al primo paint (login/landing) e i fallback critici (404).
4. **Avvolgi con `<Suspense fallback={...}>`**; usa boundary **annidati** se vuoi che parti di shell (navbar) restino visibili durante il caricamento.
5. **Gestisci il `ChunkLoadError`** post-deploy con un reload one-shot guardato (`lazyWithReload`).
6. **Verifica col build**: controlla che il chunk iniziale sia calato e che il warning > 500 kB sia sparito.

---

## File toccati in questa modifica
- `frontend/src/utils/lazyWithReload.ts` — util nuovo
- `frontend/src/App.tsx` — import → lazy + `<Suspense>` esterno
- `frontend/src/components/layout/Layout.tsx` — `<Suspense>` interno dentro l'`ErrorBoundary`

## Vedi anche
- [`cache-guide.md`](./cache-guide.md) — un'altra ottimizzazione di performance (lato backend)
- React docs: [`lazy`](https://react.dev/reference/react/lazy), [`<Suspense>`](https://react.dev/reference/react/Suspense)
