import { useNavigate } from 'react-router-dom';
import { useForecast } from '../../../hooks/useAnalytics';
import { useFormatCurrency } from '../../../hooks/useFormatCurrency';
import { formatDayMonth } from '../../../utils/date';

// Tessera KPI "Puoi spendere": risposta rapida a "quanto posso spendere al giorno
// fino al prossimo stipendio?" (stessa stima della Proiezione, senza andare sotto
// zero dopo gli impegni noti). Il click apre la Proiezione per il dettaglio.
export default function CanSpendTile() {
  const navigate = useNavigate();
  const { formatCurrency } = useFormatCurrency();
  const { data: forecast, isLoading, isError } = useForecast();

  if (isLoading) {
    return (
      <div className="dashboard-tile dashboard-tile-empty">
        <span className="dashboard-tile-label">Puoi spendere</span>
        <span className="dashboard-tile-figure-muted">…</span>
      </div>
    );
  }

  if (isError || !forecast || forecast.spendablePerDay === null) {
    return (
      <div className="dashboard-tile dashboard-tile-empty">
        <span className="dashboard-tile-label">Puoi spendere</span>
        <span className="dashboard-tile-figure-muted">
          {isError ? 'Errore caricamento' : 'Stima non disponibile'}
        </span>
      </div>
    );
  }

  const { spendablePerDay, payPeriod } = forecast;
  const until = payPeriod.configured ? 'stipendio' : 'fine mese';
  const meta = spendablePerDay === 0
    ? 'Impegni oltre la liquidità'
    : `al giorno fino al ${formatDayMonth(payPeriod.nextPayday)}`;

  return (
    <button
      type="button"
      className="dashboard-tile dashboard-tile-next"
      onClick={() => navigate('/projection')}
      aria-label={`Puoi spendere ${formatCurrency(spendablePerDay)} al giorno fino a ${until}`}
    >
      <span className="dashboard-tile-label">Puoi spendere</span>
      <span className={`dashboard-tile-figure${spendablePerDay === 0 ? ' is-expense' : ''}`}>
        {formatCurrency(spendablePerDay)}
      </span>
      <span className="dashboard-tile-meta">{meta}</span>
    </button>
  );
}
