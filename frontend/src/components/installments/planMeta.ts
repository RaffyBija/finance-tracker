import { TrendingDown, TrendingUp } from 'lucide-react';
import type { PlanDirection } from '../../types';

// Metadati per direzione del piano, riusati da card/form/modale pagamento.
// DEBT = uscita futura (paga), CREDIT = entrata attesa (incassa).
export const directionMeta = (d: PlanDirection) =>
  d === 'CREDIT'
    ? { label: 'Credito', verb: 'Incassa', verbPast: 'Incassata', Icon: TrendingUp, tone: 'credit' as const }
    : { label: 'Debito', verb: 'Paga', verbPast: 'Pagata', Icon: TrendingDown, tone: 'debt' as const };
