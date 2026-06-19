import { useNavigate } from 'react-router-dom';
import { CreditCard } from 'lucide-react';
import { useAccounts } from '../../../hooks/useAccounts';
import { useFormatCurrency } from '../../../hooks/useFormatCurrency';
import { daysUntilBilling } from '../../../utils/billing';
import { SkeletonCard } from '../../shared/Skeleton';
import type { Account } from '../../../types';

// Stessa soglia colore della pagina Conti (AccountCard.BarFill).
const usageClass = (pct: number) => (pct >= 80 ? 'is-danger' : pct >= 50 ? 'is-warn' : 'is-ok');

function CCRow({ account, onOpen }: { account: Account; onOpen: (id: string) => void }) {
  const { formatCurrency } = useFormatCurrency();
  const debt = Math.abs(account.balance);
  // Stessa formula di AccountCard.tsx: debito / limite.
  const pct = account.creditLimit ? (debt / account.creditLimit) * 100 : 0;
  const billing = account.billingDay ? daysUntilBilling(account.billingDay) : null;

  return (
    <button
      type="button"
      className="cc-usage-row"
      onClick={() => onOpen(account.id)}
      aria-label={`Apri dettaglio ${account.name}`}
    >
      <div className="cc-usage-row-top">
        <span className="cc-usage-name">
          <span className="cc-usage-dot" style={{ backgroundColor: account.color }} />
          {account.name}
        </span>
        <span className="cc-usage-debt">{formatCurrency(debt)}</span>
      </div>
      {account.creditLimit ? (
        <>
          <div className="cc-usage-bar-track">
            <div
              className={`cc-usage-bar-fill ${usageClass(pct)}`}
              style={{ width: `${Math.min(pct, 100)}%` }}
            />
          </div>
          <div className="cc-usage-meta">
            <span>Utilizzo {Math.round(pct)}%</span>
            <span>Limite {formatCurrency(account.creditLimit)}</span>
          </div>
        </>
      ) : (
        <div className="cc-usage-meta">
          <span>Nessun limite impostato</span>
        </div>
      )}
      {billing !== null && (
        <div className="cc-usage-billing">
          {billing === 0
            ? 'Addebito oggi'
            : `Addebito tra ${billing} ${billing === 1 ? 'giorno' : 'giorni'}`}
        </div>
      )}
    </button>
  );
}

// Widget "Utilizzo CC" — colpo d'occhio su debito/limite delle carte di credito.
export default function CCUsageWidget() {
  const navigate = useNavigate();
  const { data: accounts = [], isLoading } = useAccounts();

  if (isLoading) return <SkeletonCard />;

  const cards = accounts.filter((a) => a.type === 'CREDIT_CARD');

  return (
    <div className="card cc-usage">
      <div className="card-header">
        <h2 className="card-header-title">Utilizzo carte</h2>
      </div>
      {cards.length === 0 ? (
        <div className="dashboard-empty-state">
          <CreditCard size={20} className="cc-usage-empty-icon" />
          Nessuna carta di credito
        </div>
      ) : (
        <div className="cc-usage-list">
          {cards.map((card) => (
            <CCRow key={card.id} account={card} onOpen={(id) => navigate(`/accounts/${id}`)} />
          ))}
        </div>
      )}
    </div>
  );
}
