/**
 * Anteprima dei modal su dispositivi reali (motore WebKit = Safari/iOS, Chromium = Android).
 *
 * La "device mode" di Chrome emula solo la DIMENSIONE ma renderizza con Blink: NON
 * cattura i bug di Safari (es. swatch ovali). Qui usiamo il vero motore WebKit di
 * Playwright + i preset dei dispositivi, così i bug WebKit si vedono prima del deploy.
 *
 * Prerequisiti: dev server attivo (frontend su 5173, backend su 3000) e WebKit installato
 *   npx playwright install webkit
 *
 * Uso:
 *   npm run preview:devices
 *   PREVIEW_THEMES=dark PREVIEW_URL=http://localhost:5173 npm run preview:devices
 *
 * Credenziali (override via env): PREVIEW_EMAIL / PREVIEW_PASSWORD
 * Output: frontend/device-previews/<engine>-<device>-<tema>-<modal>.png
 */
import { webkit, chromium, devices } from 'playwright';
import { mkdir, rm } from 'node:fs/promises';

const BASE = process.env.PREVIEW_URL || 'http://localhost:5173';
const API = process.env.PREVIEW_API || 'http://localhost:3000/api';
const EMAIL = process.env.PREVIEW_EMAIL || 'raffy96@msn.com';
const PASSWORD = process.env.PREVIEW_PASSWORD || '123456';
const THEMES = (process.env.PREVIEW_THEMES || 'light,dark').split(',').map((t) => t.trim());
// Filtri opzionali per scoping: testa solo ciò che serve, senza rilanciare tutta la matrice.
//   PREVIEW_DEVICES=iphone        → solo i device il cui slug contiene "iphone"
//   PREVIEW_MODALS=categoria,conto → solo questi modal (match sul label)
const DEVICE_FILTER = (process.env.PREVIEW_DEVICES || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
const MODAL_FILTER = (process.env.PREVIEW_MODALS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
// PREVIEW_ROUTES=/accounts,/accounts/<id> → cattura le PAGINE (no modal), utile per
// verificare layout responsive e pagine di dettaglio. Se impostato, salta i modal.
const ROUTE_FILTER = (process.env.PREVIEW_ROUTES || '').split(',').map((s) => s.trim()).filter(Boolean);
const OUT = 'device-previews';
const TODAY = new Date().toISOString().slice(0, 10);

// Matrice device: WebKit copre iOS/Safari (il caso critico), Chromium un Android.
const TARGETS = [
  { engine: webkit,   engineName: 'safari',  device: 'iPhone 15 Pro',  landscape: false },
  { engine: webkit,   engineName: 'safari',  device: 'iPad (gen 7)',  landscape: false },
  { engine: webkit,   engineName: 'safari',  device: 'iPad (gen 7)',  landscape: true  },
  { engine: chromium, engineName: 'android', device: 'Pixel 7',       landscape: false },
];

// Modal da catturare: rotta + come aprirlo (FAB su tutte le pagine gestione).
const MODALS = [
  { route: '/transactions', label: 'transazione', title: 'Nuova Transazione' },
  { route: '/accounts',     label: 'conto',       title: 'Nuovo conto' },
  { route: '/categories',   label: 'categoria',   title: 'Nuova Categoria' },
  { route: '/budgets',      label: 'budget',      title: 'Nuovo Budget' },
  { route: '/recurring',    label: 'ricorrente',  title: 'Nuova Spesa Ricorrente' },
  { route: '/planned',      label: 'pianificata', title: 'Nuova Spesa Pianificata' },
];

function deviceOptions(name, landscape) {
  const d = devices[name];
  if (!d) throw new Error(`Device non trovato in Playwright: "${name}"`);
  if (!landscape) return d;
  const { width, height } = d.viewport;
  return { ...d, viewport: { width: height, height: width }, isLandscape: true };
}

const slug = (s) => s.replace(/[^a-z0-9]+/gi, '-').replace(/(^-|-$)/g, '').toLowerCase();

// Disabilita animazioni/transizioni: gli screenshot catturano lo stato FINALE
// (modal opaco, niente slide a metà). Va iniettato ad ogni load.
const NO_ANIM = '*,*::before,*::after{transition:none!important;animation:none!important;}';
async function killAnimations(page) {
  try { await page.addStyleTag({ content: NO_ANIM }); } catch {}
}

// Login via API una sola volta: niente UI flaky né rate-limit; il token viene
// iniettato in localStorage di ogni contesto.
async function fetchToken() {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!res.ok) throw new Error(`login API ${res.status}: ${await res.text()}`);
  const data = await res.json();
  if (!data.token) throw new Error('risposta login senza token');
  return data.token;
}

async function openOnce(page, route, file, title) {
  await page.goto(BASE + route, { waitUntil: 'domcontentloaded' });
  await killAnimations(page);
  await page.locator('.fab').first().waitFor({ state: 'attached', timeout: 25000 });
  await page.waitForTimeout(600);
  // 1) chiudi eventuali popup automatici (ricorrenti/CC in scadenza)
  await page.evaluate(() => {
    const x = document.querySelector('.modal-overlay .modal-close-btn');
    if (x) x.click();
  });
  await page.waitForTimeout(300);
  // 2) apri il create modal via evaluate (bypassa i check di cliccabilità del FAB)
  await page.evaluate(() => document.querySelector('.fab')?.click());
  // 3) il modal DEVE essere effettivamente aperto (no falsi positivi: se resta la
  //    pagina, .modal-overlay non compare e parte il retry)
  await page.locator('.modal-overlay').first().waitFor({ state: 'visible', timeout: 10000 });
  // 4) e deve mostrare il TITOLO specifico di questo modal
  await page.getByText(title, { exact: false }).first().waitFor({ state: 'visible', timeout: 10000 });
  // 5) attendi la fine dell'animazione di apertura (slideUp + background-color) così
  //    lo screenshot non cattura overlay semi-trasparente / pannello a metà
  await page.waitForTimeout(900);
  await page.screenshot({ path: file });
}

async function captureModal(page, route, file, title) {
  try {
    await openOnce(page, route, file, title);
  } catch {
    await page.waitForTimeout(1200); // un retry: assorbe lentezze del dev server
    await openOnce(page, route, file, title);
  }
}

// Cattura una pagina intera (no modal): attende il caricamento e chiude eventuali popup.
async function captureRoute(page, route, file) {
  await page.goto(BASE + route, { waitUntil: 'domcontentloaded' });
  await killAnimations(page);
  await page.waitForTimeout(900);
  await page.evaluate(() => {
    const x = document.querySelector('.modal-overlay .modal-close-btn');
    if (x) x.click();
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: file, fullPage: true });
}

async function run() {
  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });

  const token = await fetchToken();
  console.log('Login OK (token ottenuto via API)\n');

  const targets = TARGETS.filter((t) => {
    const name = `${t.engineName}-${slug(t.device)}${t.landscape ? '-landscape' : ''}`;
    return DEVICE_FILTER.length === 0 || DEVICE_FILTER.some((f) => name.includes(f));
  });
  const modals = MODALS.filter((m) => MODAL_FILTER.length === 0 || MODAL_FILTER.includes(m.label));

  for (const t of targets) {
    const browser = await t.engine.launch();
    const devName = `${t.engineName}-${slug(t.device)}${t.landscape ? '-landscape' : ''}`;
    for (const theme of THEMES) {
      const context = await browser.newContext({ ...deviceOptions(t.device, t.landscape) });
      // Consenso cookie già dato → il banner non copre il FAB
      await context.addCookies([{ name: 'financeTrackerConsent', value: 'true', url: BASE }]);
      // Inietta token (auth) + tema + sopprime i popup automatici, ad ogni load
      await context.addInitScript(([token, theme, today]) => {
        try {
          localStorage.setItem('token', token);
          localStorage.setItem('theme', theme);
          localStorage.setItem('recurringDueCheck', today);
          localStorage.setItem('ccBillingCheck', today);
          localStorage.setItem('ccClosingCheck', today);
        } catch {}
      }, [token, theme, TODAY]);

      const page = await context.newPage();
      page.setDefaultTimeout(20000);
      if (ROUTE_FILTER.length > 0) {
        // Modalità cattura pagine: una screenshot full-page per ogni rotta.
        for (const route of ROUTE_FILTER) {
          const label = slug(route) || 'home';
          const file = `${OUT}/${devName}-${theme}-page-${label}.png`;
          try {
            await captureRoute(page, route, file);
            console.log('✓', file);
          } catch (e) {
            console.log('✗', file, '—', e.message.split('\n')[0]);
          }
        }
      } else {
        for (const m of modals) {
          const file = `${OUT}/${devName}-${theme}-${m.label}.png`;
          try {
            await captureModal(page, m.route, file, m.title);
            console.log('✓', file);
          } catch (e) {
            console.log('✗', file, '—', e.message.split('\n')[0]);
          }
        }
      }
      await context.close();
    }
    await browser.close();
  }
  console.log(`\nAnteprime salvate in frontend/${OUT}/`);
}

run().catch((e) => { console.error(e); process.exit(1); });
