import { useNavigate } from 'react-router-dom';
import { useAccounts } from '../../../hooks/useAccounts';
import { useFormatCurrency } from '../../../hooks/useFormatCurrency';

// Tessera KPI per singola CC: debito + % utilizzo. Una tessera per carta.
// Soglia colore allineata alla barra di AccountCard (≥80% danger, ≥50% warn).
const usageTone = (pct: number) => (pct >= 80 ? 'is-danger' : pct >= 50 ? 'is-warn' : 'is-ok');

export default function CCTilesWidget() {
  const navigate = useNavigate();
  const { data: accounts = [] } = useAccounts();
  const { formatCurrency } = useFormatCurrency();

  const cards = accounts.filter((a) => a.type === 'CREDIT_CARD');
  if (cards.length === 0) return null;

  return (
    <>
      {cards.map((card) => {
        const debt = Math.abs(card.balance);
        const pct = card.creditLimit ? (debt / card.creditLimit) * 100 : 0;
        const tone = card.creditLimit ? usageTone(pct) : 'is-ok';
        return (
          <button
            key={card.id}
            type="button"
            className={`dashboard-tile dashboard-tile-cc ${tone}`}
            onClick={() => navigate(`/accounts/${card.id}`)}
            aria-label={`Carta ${card.name}: debito ${formatCurrency(debt)}, apri dettaglio`}
          >
            <span className="dashboard-tile-label">
              <span className="dashboard-tile-dot" style={{ backgroundColor: card.color }} />
              {card.name}
            </span>
            <span className="dashboard-tile-figure">{formatCurrency(debt)}</span>
            {card.creditLimit ? (
              <span className="dashboard-tile-meta">
                Utilizzo {Math.round(pct)}% · limite {formatCurrency(card.creditLimit)}
              </span>
            ) : (
              <span className="dashboard-tile-meta">Nessun limite</span>
            )}
          </button>
        );
      })}
    </>
  );
}
