// Copy IT/EN della landing "Il saldo che respira".
// Portato dal prototipo (GitHub Repository Exploration/Il saldo che respira.html).

export type Lang = 'it' | 'en';

export interface LedRow {
  when: string;
  name: string;
  v: number;
  rec: boolean;
}

export interface MomentCopy {
  idx: string;
  title: string;
  body: string;
}

export interface IndexRow {
  num: string;
  name: string;
  desc: string;
  meta: string;
}

export interface LandingCopy {
  // nav
  login: string;
  langLabel: string;
  toDark: string;
  toLight: string;
  // hero
  eyebrow: string;
  heroLine: string;
  balanceCap: string;
  balanceAria: string;
  annotBold: string;
  annotRest: string;
  live: string;
  m1a: string; m1b: string;
  m2a: string; m2b: string;
  m3a: string; m3b: string;
  emailPh: string;
  ctaBtn: string;
  ctaSub: string;
  // moments
  s2kicker: string;
  s2title: string;
  fragTagA: string;
  txName: string;
  txDate: string;
  txThinking: string;
  txConfirm: string;
  txCat: string;
  fragTagB: string;
  ledRows: LedRow[];
  recur: string;
  ledSum: string;
  fragTagC: string;
  chartLbl: string;
  chartToday: string;
  chartEom: string;
  moments: MomentCopy[];
  // index
  s3kicker: string;
  s3title: string;
  index: IndexRow[];
  // closing + footer
  closeLine: string;
  closeSub: string;
  footLinks: string[];
  footNote: string;
}

export const COPY: Record<Lang, LandingCopy> = {
  it: {
    login: 'Entra', langLabel: 'Lingua', toDark: 'Tema scuro', toLight: 'Tema chiaro',
    eyebrow: 'Il saldo che respira',
    heroLine: 'Sai già come <b>finisce il mese</b>.',
    balanceCap: 'Saldo proiettato · 31 marzo',
    balanceAria: 'Saldo proiettato a fine mese',
    annotBold: 'Calcolato, non sperato.',
    annotRest: 'Dal tuo saldo di oggi, fino all’ultimo giorno.',
    live: 'aggiornato ora',
    m1a: 'Comprende lo stipendio', m1b: 'del 28/03',
    m2a: 'Al netto di affitto', m2b: 'e ricorrenti',
    m3a: 'Ultimo aggiornamento', m3b: '2 minuti fa',
    emailPh: 'la tua email',
    ctaBtn: 'Inizia',
    ctaSub: 'Gratis sul piano base. Nessuna carta richiesta.',

    s2kicker: 'Come ci arriva',
    s2title: 'Tre passaggi. <b>Nessuno sforzo.</b>',
    fragTagA: 'transazione',
    txName: 'Supermercato Esselunga', txDate: 'Oggi, 14:32',
    txThinking: 'Riconosco il movimento…', txConfirm: 'Categorizzato come «Spesa». Nessun tocco richiesto.',
    txCat: 'Spesa',
    fragTagB: 'proiezione',
    ledRows: [
      { when: '28/03', name: 'Stipendio', v: 2400, rec: true },
      { when: '01/04', name: 'Affitto', v: -850, rec: true },
      { when: '03/04', name: 'Abbonamenti', v: -38, rec: true },
      { when: '05/04', name: 'Spesa pianificata', v: -150, rec: false },
    ],
    recur: 'ricorrente', ledSum: 'Saldo a fine mese',
    fragTagC: 'outlook',
    chartLbl: 'Andamento del saldo', chartToday: 'oggi', chartEom: '31 mar',

    moments: [
      { idx: '01', title: 'Registri ciò che accade.',
        body: 'Aggiungi un movimento. Lui sa già dov’è: <b>si categorizza da solo</b>, mentre tu pensi ad altro.' },
      { idx: '02', title: 'Il sistema proietta.',
        body: 'Stipendi, affitto, abbonamenti. Tutto ciò che si ripete <b>entra nel futuro e si somma</b>, giorno per giorno, fino alla fine del mese.' },
      { idx: '03', title: 'Vedi il mese prima che arrivi.',
        body: 'Una linea sola. Dove sei oggi, dove sarai il 31. <b>Niente sorprese</b> nell’ultima settimana.' },
    ],

    s3kicker: 'E poi, tutto il resto',
    s3title: 'Quando ti serve, <b>è già lì.</b>',
    index: [
      { num: 'I', name: 'Conti & carte', desc: 'Conto, risparmi e carta di credito — con i suoi cicli di fatturazione, calcolati al giorno giusto.', meta: '3 conti' },
      { num: 'II', name: 'Budget per categoria', desc: 'Un tetto per ogni voce. Ti avvisa con calma, prima che tu lo superi.', meta: '8 categorie' },
      { num: 'III', name: 'Calendario', desc: 'Ogni scadenza al suo posto. La settimana che arriva, in una pagina.', meta: 'vista mese' },
      { num: 'IV', name: 'Trend mensile', desc: 'Entrate e uscite, sei mesi a colpo d’occhio. Per capire dove va, non solo dov’è.', meta: '6 mesi' },
    ],

    closeLine: 'Apri l’app. <b>Guarda la fine del mese.</b>',
    closeSub: 'Il tuo primo saldo proiettato è pronto in un minuto. Poi resta lì, ad aggiornarsi da solo.',
    footLinks: ['Privacy', 'Termini', 'Contatti'],
    footNote: 'Fatto con calma, in Italia.',
  },
  en: {
    login: 'Sign in', langLabel: 'Language', toDark: 'Dark theme', toLight: 'Light theme',
    eyebrow: 'The breathing balance',
    heroLine: 'You already know <b>how the month ends</b>.',
    balanceCap: 'Projected balance · March 31',
    balanceAria: 'Projected end-of-month balance',
    annotBold: 'Calculated, not hoped for.',
    annotRest: 'From today’s balance, all the way to the last day.',
    live: 'updated now',
    m1a: 'Includes the salary', m1b: 'of Mar 28',
    m2a: 'Net of rent', m2b: 'and recurring',
    m3a: 'Last updated', m3b: '2 minutes ago',
    emailPh: 'your email',
    ctaBtn: 'Start',
    ctaSub: 'Free on the base plan. No card required.',

    s2kicker: 'How it gets there',
    s2title: 'Three steps. <b>No effort.</b>',
    fragTagA: 'transaction',
    txName: 'Esselunga Supermarket', txDate: 'Today, 2:32 PM',
    txThinking: 'Reading the movement…', txConfirm: 'Filed under “Groceries”. No tap required.',
    txCat: 'Groceries',
    fragTagB: 'projection',
    ledRows: [
      { when: 'Mar 28', name: 'Salary', v: 2400, rec: true },
      { when: 'Apr 01', name: 'Rent', v: -850, rec: true },
      { when: 'Apr 03', name: 'Subscriptions', v: -38, rec: true },
      { when: 'Apr 05', name: 'Planned expense', v: -150, rec: false },
    ],
    recur: 'recurring', ledSum: 'Balance at month end',
    fragTagC: 'outlook',
    chartLbl: 'Balance outlook', chartToday: 'today', chartEom: 'Mar 31',

    moments: [
      { idx: '01', title: 'You record what happens.',
        body: 'Add a movement. It already knows where it belongs: <b>it categorizes itself</b>, while you think of other things.' },
      { idx: '02', title: 'The system projects.',
        body: 'Salaries, rent, subscriptions. Everything that repeats <b>enters the future and adds up</b>, day by day, all the way to month’s end.' },
      { idx: '03', title: 'You see the month before it arrives.',
        body: 'A single line. Where you are today, where you’ll be on the 31st. <b>No surprises</b> in the last week.' },
    ],

    s3kicker: 'And then, everything else',
    s3title: 'When you need it, <b>it’s already there.</b>',
    index: [
      { num: 'I', name: 'Accounts & cards', desc: 'Checking, savings and credit card — with its billing cycles, counted on the right day.', meta: '3 accounts' },
      { num: 'II', name: 'Category budgets', desc: 'A ceiling for every line. It warns you calmly, before you cross it.', meta: '8 categories' },
      { num: 'III', name: 'Calendar', desc: 'Every due date in its place. The week ahead, on a single page.', meta: 'month view' },
      { num: 'IV', name: 'Monthly trend', desc: 'Income and outflow, six months at a glance. To see where it’s going, not just where it is.', meta: '6 months' },
    ],

    closeLine: 'Open the app. <b>Look at the end of the month.</b>',
    closeSub: 'Your first projected balance is ready in a minute. Then it stays there, updating on its own.',
    footLinks: ['Privacy', 'Terms', 'Contact'],
    footNote: 'Made calmly, in Italy.',
  },
};
