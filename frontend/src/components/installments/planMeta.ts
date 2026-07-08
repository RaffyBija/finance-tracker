import { isPast, isToday, isTomorrow } from 'date-fns';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { formatDayMonth } from '../../utils/date';
import type { InstallmentRata, PlanDirection } from '../../types';

// Metadati per direzione del piano, riusati da card/form/modale pagamento.
// DEBT = uscita futura (paga), CREDIT = entrata attesa (incassa).
export const directionMeta = (d: PlanDirection) =>
  d === 'CREDIT'
    ? { label: 'Credito', verb: 'Incassa', verbPast: 'Incassata', Icon: TrendingUp, tone: 'credit' as const }
    : { label: 'Debito', verb: 'Paga', verbPast: 'Pagata', Icon: TrendingDown, tone: 'debt' as const };

// Stato di una rata: pagata / oggi / scaduta / domani / data futura.
// Riusato da card (prossima rata) e lista rate nel dettaglio.
export function rataStatus(r: InstallmentRata, verbPast: string) {
  if (r.isPaid) return { text: verbPast, cls: 'plan-rate-badge--paid' };
  const d = new Date(r.plannedDate!); // le rate hanno sempre una data
  if (isToday(d)) return { text: 'Oggi', cls: 'plan-rate-badge--today' };
  if (isPast(d)) return { text: 'Scaduta', cls: 'plan-rate-badge--overdue' };
  if (isTomorrow(d)) return { text: 'Domani', cls: 'plan-rate-badge--soon' };
  return { text: formatDayMonth(d), cls: 'plan-rate-badge--upcoming' };
}

// Etichetta breve della rata (il titolo del piano è già nel contesto):
// controparte se presente, altrimenti la parte dopo "— " della descrizione.
export const rataShortLabel = (r: InstallmentRata) =>
  r.counterparty?.trim() || r.description.split(' — ').slice(1).join(' — ') || r.description;
