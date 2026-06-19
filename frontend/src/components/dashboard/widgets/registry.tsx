import type { ComponentType } from 'react';
import QuickActionsWidget from './QuickActionsWidget';
import CCUsageWidget from './CCUsageWidget';
import DueSoonWidget from './DueSoonWidget';
import ProjectionWidget from './ProjectionWidget';
import BudgetOverviewWidget from './BudgetOverviewWidget';
import SubscriptionWidget from './SubscriptionWidget';
import MonthlyTrendWidget from './MonthlyTrendWidget';
import CategoryPieWidget from './CategoryPieWidget';
import RecentTransactionsWidget from './RecentTransactionsWidget';

export type WidgetId =
  | 'quick-actions'
  | 'cc-usage'
  | 'due-soon'
  | 'projection'
  | 'budget-overview'
  | 'subscription'
  | 'monthly-trend'
  | 'category-pie'
  | 'recent-transactions';

export interface WidgetDef {
  id: WidgetId;
  title: string;
  description: string;
  defaultEnabled: boolean;
  /** Span nella griglia: 'full' = larghezza piena, 'half' = colonna compatta. */
  size: 'full' | 'half';
  component: ComponentType;
}

// Ordine = ordine di default in dashboard. L'utente può riordinare/disattivare
// dal pannello "Personalizza" (persistito in localStorage da useDashboardLayout).
export const WIDGET_REGISTRY: WidgetDef[] = [
  {
    id: 'quick-actions',
    title: 'Azioni rapide',
    description: 'Apri al volo: nuova transazione, trasferimento o pianificata.',
    defaultEnabled: true,
    size: 'half',
    component: QuickActionsWidget,
  },
  {
    id: 'cc-usage',
    title: 'Utilizzo carte',
    description: 'Debito e utilizzo delle carte di credito, con il prossimo addebito.',
    defaultEnabled: true,
    size: 'half',
    component: CCUsageWidget,
  },
  {
    id: 'due-soon',
    title: 'In scadenza',
    description: 'Ricorrenti e pianificate in arrivo nei prossimi giorni.',
    defaultEnabled: true,
    size: 'half',
    component: DueSoonWidget,
  },
  {
    id: 'projection',
    title: 'Andamento del saldo',
    description: 'Proiezione e stima del saldo nel tempo.',
    defaultEnabled: true,
    size: 'full',
    component: ProjectionWidget,
  },
  {
    id: 'budget-overview',
    title: 'Budget',
    description: 'Avanzamento dei budget attivi del mese.',
    defaultEnabled: false,
    size: 'half',
    component: BudgetOverviewWidget,
  },
  {
    id: 'subscription',
    title: 'Spese ricorrenti',
    description: 'Costo mensile e annuale degli impegni ricorrenti.',
    defaultEnabled: false,
    size: 'half',
    component: SubscriptionWidget,
  },
  {
    id: 'monthly-trend',
    title: 'Trend mensile',
    description: 'Entrate e uscite degli ultimi 6 mesi.',
    defaultEnabled: false,
    size: 'full',
    component: MonthlyTrendWidget,
  },
  {
    id: 'category-pie',
    title: 'Spese per categoria',
    description: 'Ripartizione delle uscite del mese selezionato.',
    defaultEnabled: false,
    size: 'full',
    component: CategoryPieWidget,
  },
  {
    id: 'recent-transactions',
    title: 'Transazioni recenti',
    description: 'Le ultime 5 transazioni di tutti i conti.',
    defaultEnabled: false,
    size: 'full',
    component: RecentTransactionsWidget,
  },
];

export const WIDGET_MAP: Record<WidgetId, WidgetDef> = WIDGET_REGISTRY.reduce(
  (acc, def) => {
    acc[def.id] = def;
    return acc;
  },
  {} as Record<WidgetId, WidgetDef>
);
