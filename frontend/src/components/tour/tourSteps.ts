export type TourPosition = 'top' | 'bottom' | 'center';

export interface TourStep {
  id: string;
  target: string | null;
  title: string;
  content: string;
  position: TourPosition;
  cta?: { label: string; href: string };
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    target: null,
    title: 'Benvenuto in Finance Tracker 👋',
    content: 'Ti guidiamo in 4 passi per scoprire le funzioni principali e iniziare a tracciare le tue finanze.',
    position: 'center',
  },
  {
    id: 'dashboard',
    target: '[data-tour="dashboard-hero"]',
    title: 'Il tuo saldo',
    content: 'Qui vedi il saldo complessivo e le statistiche mensili. Con più conti diventa il patrimonio netto con breakdown per conto.',
    position: 'bottom',
  },
  {
    id: 'navigation',
    target: '[data-tour="mobile-nav"]',
    title: 'Navigazione',
    content: 'Dashboard, Transazioni, Conti e Calendario sono le sezioni principali. Nel "Menu" trovi le sezioni Analisi (Patrimonio, Proiezione) e Gestione (Budget, Categorie, Ricorrenti, Pianificati).',
    position: 'top',
  },
  {
    id: 'accounts',
    target: '[data-tour="conti-tab"]',
    title: 'Parti dai Conti',
    content: 'Aggiungi il tuo conto corrente e la tua carta di credito. La CC traccia il debito e ti avvisa automaticamente il giorno dell\'addebito mensile.',
    position: 'top',
  },
  {
    id: 'done',
    target: null,
    title: 'Tutto pronto! 🎉',
    content: 'Inizia aggiungendo i tuoi conti e categorie. Puoi riavviare questo tour o leggere la Guida completa dal menu del profilo.',
    position: 'center',
    cta: { label: 'Vai ai Conti →', href: '/accounts' },
  },
];
