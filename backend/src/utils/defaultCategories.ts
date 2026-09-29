import { Prisma, CategoryNature, TransactionType } from '@prisma/client';
import prisma from './prisma';

// ── Categorie predefinite (uguali per tutti) ─────────────────────────────────
//
//   Due livelli: macro-categoria → sotto-categorie. Create alla registrazione e
//   offerte agli utenti esistenti con "Organizza categorie". Ogni categoria creata
//   da qui ricorda la sua `templateKey`: serve per riconoscerla (es. lo stipendio
//   per il periodo di paga) anche se l'utente la rinomina.
//   I nomi sono unici per tipo (vincolo [userId, name, type]).

export interface CategoryTemplateChild {
  key: string;
  name: string;
  icon: string;
  keywords?: string[];
}

export interface CategoryTemplate {
  key: string;
  name: string;
  type: TransactionType;
  icon: string;
  color: string;
  nature?: CategoryNature;
  keywords?: string[];
  children: CategoryTemplateChild[];
}

export const SALARY_TEMPLATE_KEY = 'income.work.salary';

export const DEFAULT_CATEGORIES: CategoryTemplate[] = [
  {
    key: 'expense.home', name: 'Casa', type: 'EXPENSE', icon: '🏠', color: '#0EA5E9', nature: 'ESSENTIAL',
    keywords: ['casa', 'abitazione'],
    children: [
      { key: 'expense.home.rent', name: 'Affitto e mutuo', icon: '🔑', keywords: ['affitto', 'mutuo', 'locazione'] },
      { key: 'expense.home.utilities', name: 'Bollette', icon: '🧾', keywords: ['bollett', 'luce', 'gas', 'acqua', 'enel', 'energia', 'utenze', 'rifiuti', 'tari'] },
      { key: 'expense.home.condo', name: 'Condominio', icon: '🏢', keywords: ['condomin'] },
      { key: 'expense.home.maintenance', name: 'Manutenzione casa', icon: '🛠️', keywords: ['manutenzion', 'riparazion', 'idraulic', 'elettricist', 'depurator'] },
      { key: 'expense.home.furniture', name: 'Arredamento', icon: '🛋️', keywords: ['arred', 'mobili', 'ikea'] },
    ],
  },
  {
    key: 'expense.food', name: 'Alimentari', type: 'EXPENSE', icon: '🛒', color: '#10B981', nature: 'ESSENTIAL',
    keywords: ['alimentar', 'cibo'],
    children: [
      { key: 'expense.food.groceries', name: 'Spesa', icon: '🛒', keywords: ['spesa', 'supermercat', 'esselunga', 'lidl', 'coop', 'conad', 'carrefour', 'eurospin'] },
      { key: 'expense.food.shops', name: 'Negozi alimentari', icon: '🥖', keywords: ['panettier', 'macelleri', 'mercato', 'fruttivendol', 'forno'] },
    ],
  },
  {
    key: 'expense.eatout', name: 'Ristoranti e bar', type: 'EXPENSE', icon: '🍽️', color: '#EF4444', nature: 'DISCRETIONARY',
    keywords: ['ristorant', 'uscit'],
    children: [
      { key: 'expense.eatout.bar', name: 'Bar e caffè', icon: '☕', keywords: ['bar', 'caff', 'colazion', 'aperitiv'] },
      { key: 'expense.eatout.restaurants', name: 'Ristoranti', icon: '🍽️', keywords: ['ristorant', 'pizz', 'trattori', 'sushi', 'osteri'] },
      { key: 'expense.eatout.delivery', name: 'Cibo a domicilio', icon: '🛵', keywords: ['domicilio', 'delivery', 'asporto', 'glovo', 'deliveroo', 'just eat'] },
    ],
  },
  {
    key: 'expense.transport', name: 'Trasporti', type: 'EXPENSE', icon: '🚗', color: '#F59E0B', nature: 'ESSENTIAL',
    keywords: ['traspor', 'auto', 'macchina'],
    children: [
      { key: 'expense.transport.fuel', name: 'Carburante', icon: '⛽', keywords: ['carburant', 'benzin', 'diesel', 'gasolio', 'eni', 'q8', 'ip ', 'tamoil', 'esso'] },
      { key: 'expense.transport.public', name: 'Mezzi pubblici', icon: '🚌', keywords: ['bus', 'treno', 'metro', 'trenitalia', 'italo', 'abbonamento atm', 'mezzi'] },
      { key: 'expense.transport.maintenance', name: 'Manutenzione auto', icon: '🔧', keywords: ['meccanic', 'gomme', 'tagliando', 'revisione', 'officina'] },
      { key: 'expense.transport.insurance', name: 'Assicurazione auto', icon: '🛡️', keywords: ['rca', 'assicurazione auto'] },
      { key: 'expense.transport.tax', name: 'Bollo auto', icon: '📄', keywords: ['bollo'] },
      { key: 'expense.transport.parking', name: 'Parcheggi e pedaggi', icon: '🅿️', keywords: ['parchegg', 'pedagg', 'autostrad', 'telepass'] },
      { key: 'expense.transport.taxi', name: 'Taxi e noleggi', icon: '🚕', keywords: ['taxi', 'uber', 'noleggi', 'car sharing'] },
    ],
  },
  {
    key: 'expense.health', name: 'Salute', type: 'EXPENSE', icon: '🏥', color: '#14B8A6', nature: 'ESSENTIAL',
    keywords: ['salute', 'medic', 'sanit'],
    children: [
      { key: 'expense.health.pharmacy', name: 'Farmacia', icon: '💊', keywords: ['farmac', 'medicin'] },
      { key: 'expense.health.visits', name: 'Visite ed esami', icon: '🩺', keywords: ['visit', 'esam', 'dentist', 'ticket', 'analisi'] },
      { key: 'expense.health.insurance', name: 'Assicurazione sanitaria', icon: '❤️', keywords: ['assicurazione sanitaria', 'polizza salute'] },
    ],
  },
  {
    key: 'expense.personal', name: 'Cura personale', type: 'EXPENSE', icon: '👕', color: '#EC4899', nature: 'DISCRETIONARY',
    keywords: ['personal'],
    children: [
      { key: 'expense.personal.clothing', name: 'Abbigliamento', icon: '👕', keywords: ['abbigliament', 'vestit', 'scarpe', 'zara'] },
      { key: 'expense.personal.care', name: 'Cura della persona', icon: '💇', keywords: ['parrucch', 'barbier', 'estetist', 'cosmetic', 'profum'] },
      { key: 'expense.personal.sport', name: 'Sport e palestra', icon: '🏋️', keywords: ['palestr', 'sport', 'piscin'] },
    ],
  },
  {
    key: 'expense.leisure', name: 'Svago', type: 'EXPENSE', icon: '🎮', color: '#8B5CF6', nature: 'DISCRETIONARY',
    keywords: ['svago', 'divertiment', 'tempo libero'],
    children: [
      { key: 'expense.leisure.subscriptions', name: 'Abbonamenti', icon: '📺', keywords: ['abbonament', 'netflix', 'spotify', 'nowtv', 'now tv', 'disney', 'dazn', 'prime', 'streaming', 'claude'] },
      { key: 'expense.leisure.events', name: 'Uscite ed eventi', icon: '🎟️', keywords: ['cinema', 'concert', 'teatro', 'evento', 'bigliett'] },
      { key: 'expense.leisure.hobby', name: 'Hobby', icon: '🎨', keywords: ['hobby', 'libri', 'giochi', 'videogioc'] },
      { key: 'expense.leisure.travel', name: 'Viaggi', icon: '✈️', keywords: ['viagg', 'vacanz', 'hotel', 'volo', 'airbnb', 'booking'] },
    ],
  },
  {
    key: 'expense.tech', name: 'Tecnologia e telefonia', type: 'EXPENSE', icon: '📱', color: '#6366F1', nature: 'ESSENTIAL',
    keywords: ['tecnolog', 'telefon'],
    children: [
      { key: 'expense.tech.phone', name: 'Telefono', icon: '📱', keywords: ['telefon', 'ricaric', 'vodafone', 'tim', 'iliad', 'windtre', 'cellular'] },
      { key: 'expense.tech.internet', name: 'Internet', icon: '🌐', keywords: ['internet', 'fibra', 'adsl', 'fastweb'] },
      { key: 'expense.tech.devices', name: 'Dispositivi e software', icon: '💻', keywords: ['computer', 'software', 'amazon', 'elettronic', 'app store'] },
    ],
  },
  {
    key: 'expense.family', name: 'Famiglia e animali', type: 'EXPENSE', icon: '👪', color: '#F97316', nature: 'ESSENTIAL',
    keywords: ['famiglia'],
    children: [
      { key: 'expense.family.kids', name: 'Figli', icon: '🧸', keywords: ['figli', 'bambin', 'scuola materna', 'asilo'] },
      { key: 'expense.family.pets', name: 'Animali', icon: '🐶', keywords: ['animal', 'veterinar', 'cane', 'gatto'] },
      { key: 'expense.family.gifts', name: 'Regali', icon: '🎁', keywords: ['regal', 'aiuto'] },
    ],
  },
  {
    key: 'expense.finance', name: 'Finanza e tasse', type: 'EXPENSE', icon: '🏦', color: '#78716C', nature: 'ESSENTIAL',
    keywords: ['finanz'],
    children: [
      { key: 'expense.finance.taxes', name: 'Tasse e imposte', icon: '🏛️', keywords: ['tass', 'impost', 'f24', '730', 'irpef', 'imu'] },
      { key: 'expense.finance.loans', name: 'Rate e prestiti', icon: '💳', keywords: ['rata', 'rate', 'prestit', 'finanziament'] },
      { key: 'expense.finance.fees', name: 'Commissioni bancarie', icon: '🏦', keywords: ['commission', 'canone conto', 'spese bancarie'] },
      { key: 'expense.finance.insurance', name: 'Assicurazioni', icon: '🛡️', keywords: ['assicuraz', 'polizza'] },
    ],
  },
  {
    key: 'expense.education', name: 'Istruzione', type: 'EXPENSE', icon: '🎓', color: '#0284C7', nature: 'ESSENTIAL',
    keywords: ['istruzion', 'scuola', 'universit', 'corso', 'formazion'],
    children: [],
  },
  {
    key: 'expense.other', name: 'Altre spese', type: 'EXPENSE', icon: '📦', color: '#A8A29E', nature: 'DISCRETIONARY',
    keywords: ['altro', 'varie'],
    children: [],
  },
  {
    key: 'income.work', name: 'Lavoro', type: 'INCOME', icon: '💼', color: '#059669',
    keywords: ['lavor'],
    children: [
      { key: SALARY_TEMPLATE_KEY, name: 'Stipendio', icon: '💰', keywords: ['stipend', 'salari', 'busta paga', 'cedolin'] },
      { key: 'income.work.extra', name: 'Extra e straordinari', icon: '⏱️', keywords: ['extra', 'straordinar', 'freelance', 'bonus', 'tredicesima'] },
      { key: 'income.work.expenses', name: 'Rimborsi spese', icon: '🧾', keywords: ['rimborso spese', 'trasferta'] },
    ],
  },
  {
    key: 'income.other', name: 'Altre entrate', type: 'INCOME', icon: '💶', color: '#22C55E',
    keywords: ['altr'],
    children: [
      { key: 'income.other.refunds', name: 'Rimborsi', icon: '↩️', keywords: ['rimbors', 'reso'] },
      { key: 'income.other.gifts', name: 'Regali ricevuti', icon: '🎁', keywords: ['regal'] },
      { key: 'income.other.sales', name: 'Vendite', icon: '🏷️', keywords: ['vendit', 'vinted', 'subito'] },
      { key: 'income.other.interest', name: 'Interessi e rendimenti', icon: '📈', keywords: ['interess', 'rendiment', 'dividend', 'cedol'] },
    ],
  },
];

// Crea le categorie predefinite mancanti (per nome e tipo) per l'utente. Idempotente:
// non tocca quelle già presenti. Con `setSalary` imposta anche la categoria stipendio
// del periodo di paga, se l'utente non ne ha una.
export async function seedDefaultCategories(
  userId: string,
  opts: { setSalary?: boolean } = {},
  db: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<{ created: number }> {
  const existing = await db.category.findMany({ where: { userId }, select: { id: true, name: true, type: true, templateKey: true } });
  const byName = new Map(existing.map((c) => [`${c.type}:${c.name.toLowerCase()}`, c.id]));
  // Una categoria dell'utente che ha già preso il posto di una predefinita (stessa
  // templateKey, es. "Affitto" per "Affitto e mutuo") evita il duplicato.
  const byTemplate = new Map(existing.filter((c) => c.templateKey).map((c) => [c.templateKey!, c.id]));
  let created = 0;

  for (const [mi, macro] of DEFAULT_CATEGORIES.entries()) {
    let macroId = byTemplate.get(macro.key) ?? byName.get(`${macro.type}:${macro.name.toLowerCase()}`);
    if (!macroId) {
      const m = await db.category.create({
        data: {
          userId, name: macro.name, type: macro.type, icon: macro.icon, color: macro.color,
          nature: macro.nature ?? null, templateKey: macro.key, sortOrder: mi,
        },
        select: { id: true },
      });
      macroId = m.id;
      created += 1;
    }
    for (const [ci, child] of macro.children.entries()) {
      if (byTemplate.has(child.key) || byName.has(`${macro.type}:${child.name.toLowerCase()}`)) continue;
      await db.category.create({
        data: {
          userId, name: child.name, type: macro.type, icon: child.icon, color: macro.color,
          parentId: macroId, templateKey: child.key, sortOrder: ci,
        },
      });
      created += 1;
    }
  }

  if (opts.setSalary) {
    const user = await db.user.findUnique({ where: { id: userId }, select: { salaryCategoryId: true } });
    if (!user?.salaryCategoryId) {
      const salary = await db.category.findFirst({ where: { userId, templateKey: SALARY_TEMPLATE_KEY }, select: { id: true } });
      if (salary) await db.user.update({ where: { id: userId }, data: { salaryCategoryId: salary.id } });
    }
  }
  return { created };
}

// ── Abbinamento automatico (Organizza categorie) ─────────────────────────────

const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

export interface OrganizeSuggestion {
  // Una categoria esistente può diventare una macro predefinita ('macro'), finire
  // sotto una macro predefinita ('child'), o restare macro personale (null).
  role: 'macro' | 'child' | null;
  macroKey: string | null;
  childKey: string | null;
}

// Funzione PURA: indovina dove collocare una categoria dal nome.
//   1. nome uguale a una macro → è quella macro;
//   2. nome uguale a una sotto-categoria → è quella sotto-categoria;
//   3. parole chiave (sotto-categorie prima, poi macro) → va sotto quella macro;
//   4. nessun indizio → resta macro personale.
export function suggestPlacement(name: string, type: TransactionType): OrganizeSuggestion {
  const n = normalize(name);
  const macros = DEFAULT_CATEGORIES.filter((m) => m.type === type);
  for (const m of macros) {
    if (normalize(m.name) === n) return { role: 'macro', macroKey: m.key, childKey: null };
    const child = m.children.find((c) => normalize(c.name) === n);
    if (child) return { role: 'child', macroKey: m.key, childKey: child.key };
  }
  const padded = ` ${n} `;
  const hit = (kw: string) => padded.includes(normalize(kw).length <= 3 ? ` ${normalize(kw)} ` : normalize(kw));
  for (const m of macros) {
    const child = m.children.find((c) => (c.keywords ?? []).some(hit));
    // Riconosciuta per parola chiave: prende il posto di quella sotto-categoria
    // predefinita (niente doppione "Affitto" + "Affitto e mutuo").
    if (child) return { role: 'child', macroKey: m.key, childKey: child.key };
  }
  for (const m of macros) {
    if ((m.keywords ?? []).some(hit)) return { role: 'child', macroKey: m.key, childKey: null };
  }
  return { role: null, macroKey: null, childKey: null };
}

export const templateByKey = (key: string): CategoryTemplate | undefined =>
  DEFAULT_CATEGORIES.find((m) => m.key === key);

// Ordine canonico: macro predefinite nell'ordine del modello, poi quelle personali;
// dentro ogni macro le sotto-categorie predefinite nel loro ordine, poi le altre.
export async function normalizeCategoryOrder(userId: string, db: Prisma.TransactionClient | typeof prisma = prisma) {
  const cats = await db.category.findMany({ where: { userId }, select: { id: true, parentId: true, templateKey: true, name: true, sortOrder: true } });
  const macroIndex = new Map(DEFAULT_CATEGORIES.map((m, i) => [m.key, i]));
  const childIndex = new Map(DEFAULT_CATEGORIES.flatMap((m) => m.children.map((c, i) => [c.key, i] as const)));
  const rank = (c: (typeof cats)[number]) => {
    const idx = c.parentId ? childIndex.get(c.templateKey ?? '') : macroIndex.get(c.templateKey ?? '');
    return idx ?? 100 + c.sortOrder;
  };
  const groups = new Map<string, typeof cats>();
  for (const c of cats) {
    const k = c.parentId ?? 'root';
    groups.set(k, [...(groups.get(k) ?? []), c]);
  }
  for (const list of groups.values()) {
    const ordered = [...list].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, 'it'));
    for (const [i, c] of ordered.entries()) {
      if (c.sortOrder !== i) await db.category.update({ where: { id: c.id }, data: { sortOrder: i } });
    }
  }
}
