import type { ComponentType } from 'react';
import QuickActionsWidget from './QuickActionsWidget';
import CCTilesWidget from './CCTilesWidget';
import NextExpenseTile from './NextExpenseTile';
import BudgetRiskTile from './BudgetRiskTile';
import DueSoonWidget from './DueSoonWidget';
import ProjectionWidget from './ProjectionWidget';
import BudgetOverviewWidget from './BudgetOverviewWidget';
import SubscriptionWidget from './SubscriptionWidget';
import MonthlyTrendWidget from './MonthlyTrendWidget';
import CategoryPieWidget from './CategoryPieWidget';
import RecentTransactionsWidget from './RecentTransactionsWidget';

export type WidgetId =
  | 'quick-actions'
  | 'cc-tiles'
  | 'next-expense'
  | 'budget-risk'
  | 'projection'
  | 'due-soon'
  | 'budget-overview'
  | 'subscription'
  | 'monthly-trend'
  | 'category-pie'
  | 'recent-transactions';

/**
 * Zona di rendering del widget:
 *  - 'bar'     → barra compatta sotto l'Hero (azioni rapide)
 *  - 'tile'    → fascia tessere KPI glanceable (può emettere più tessere)
 *  - 'content' → griglia contenuti (usa `size` full/half)
 */
export type WidgetSlot = 'bar' | 'tile' | 'content';

export interface WidgetDef {
  id: WidgetId;
  title: string;
  description: string;
  defaultEnabled: boolean;
  slot: WidgetSlot;
  /** Span nella griglia contenuti: 'full' = larghezza piena, 'half' = colonna. Solo per slot 'content'. */
  size: 'full' | 'half';
  component: ComponentType;
}

// Ordine = ordine di default. L'utente riordina/disattiva dal pannello "Personalizza";
// il riordino agisce all'interno della stessa zona (bar/tile/content).
export const WIDGET_REGISTRY: WidgetDef[] = [
  {
    id: 'quick-actions',
    title: 'Azioni rapide',
    description: 'Barra per aprire al volo: transazione, trasferimento o pianificata.',
    defaultEnabled: true,
    slot: 'bar',
    size: 'full',
    component: QuickActionsWidget,
  },
  {
    id: 'cc-tiles',
    title: 'Carte di credito',
    description: 'Una tessera per carta: debito e utilizzo a colpo d’occhio.',
    defaultEnabled: true,
    slot: 'tile',
    size: 'half',
    component: CCTilesWidget,
  },
  {
    id: 'next-expense',
    title: 'Prossima uscita',
    description: 'La prossima uscita in arrivo: importo e data.',
    defaultEnabled: true,
    slot: 'tile',
    size: 'half',
    component: NextExpenseTile,
  },
  {
    id: 'budget-risk',
    title: 'Budget a rischio',
    description: 'Quanti budget sono vicini al limite o sforati questo mese.',
    defaultEnabled: true,
    slot: 'tile',
    size: 'half',
    component: BudgetRiskTile,
  },
  {
    id: 'projection',
    title: 'Andamento del saldo',
    description: 'Proiezione e stima del saldo nel tempo.',
    defaultEnabled: true,
    slot: 'content',
    size: 'full',
    component: ProjectionWidget,
  },
  {
    id: 'due-soon',
    title: 'In scadenza',
    description: 'Ricorrenti e pianificate in arrivo nei prossimi giorni.',
    defaultEnabled: true,
    slot: 'content',
    size: 'half',
    component: DueSoonWidget,
  },
  {
    id: 'budget-overview',
    title: 'Budget',
    description: 'Avanzamento dei budget attivi del mese.',
    defaultEnabled: false,
    slot: 'content',
    size: 'half',
    component: BudgetOverviewWidget,
  },
  {
    id: 'subscription',
    title: 'Spese ricorrenti',
    description: 'Costo mensile e annuale degli impegni ricorrenti.',
    defaultEnabled: false,
    slot: 'content',
    size: 'half',
    component: SubscriptionWidget,
  },
  {
    id: 'monthly-trend',
    title: 'Trend mensile',
    description: 'Entrate e uscite degli ultimi 6 mesi.',
    defaultEnabled: false,
    slot: 'content',
    size: 'full',
    component: MonthlyTrendWidget,
  },
  {
    id: 'category-pie',
    title: 'Spese per categoria',
    description: 'Ripartizione delle uscite, con selettore del mese.',
    defaultEnabled: false,
    slot: 'content',
    size: 'full',
    component: CategoryPieWidget,
  },
  {
    id: 'recent-transactions',
    title: 'Transazioni recenti',
    description: 'Le ultime 5 transazioni di tutti i conti.',
    defaultEnabled: false,
    slot: 'content',
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
