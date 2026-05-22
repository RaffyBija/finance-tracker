import { TrendingUp, TrendingDown, Calendar } from 'lucide-react';
import { useForecast } from '../../hooks/useAnalytics';
import { SkeletonCard } from '../shared/Skeleton';

export default function ForecastCard() {
  const { data: forecast, isLoading } = useForecast();

  if (isLoading) return <SkeletonCard />;
  if (!forecast) return null;

  const {
    daysElapsed,
    daysInMonth,
    daysRemaining,
    currentBalance,
    currentMonthActual,
    knownRemaining,
    historicalAvg,
    habitualRemaining,
    projectedEndBalance,
  } = forecast;

  const isPositive = projectedEndBalance >= currentBalance;
  const delta = projectedEndBalance - currentBalance;
  const progressPct = Math.round((daysElapsed / daysInMonth) * 100);

  const fmt = (v: number) =>
    v.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="forecast-card">
      <div className="forecast-card-header">
        <div className="forecast-card-title-group">
          <Calendar size={16} className="forecast-card-icon" />
          <div>
            <span className="forecast-card-title">Previsione fine mese</span>
            <p className="forecast-card-subtitle">Stima basata su pattern per categoria + impegni pianificati</p>
          </div>
        </div>
        <span className="forecast-card-days">
          {daysRemaining > 0 ? `${daysRemaining} giorni rimanenti` : 'Ultimo giorno'}
        </span>
      </div>

      {/* Progress giorni del mese */}
      <div className="forecast-progress-bar">
        <div className="forecast-progress-fill" style={{ width: `${progressPct}%` }} />
      </div>
      <div className="forecast-progress-labels">
        <span>1</span>
        <span>Oggi ({daysElapsed})</span>
        <span>{daysInMonth}</span>
      </div>

      {/* Saldo proiettato */}
      <div className="forecast-projected">
        <p className="forecast-projected-label">Saldo stimato a fine mese</p>
        <p className={`forecast-projected-value${projectedEndBalance < 0 ? ' is-negative' : ''}`}>
          {projectedEndBalance >= 0 ? '+' : '−'}€{fmt(Math.abs(projectedEndBalance))}
        </p>
        <div className={`forecast-delta${isPositive ? ' is-positive' : ' is-negative'}`}>
          {isPositive
            ? <TrendingUp size={13} />
            : <TrendingDown size={13} />
          }
          <span>
            {isPositive ? '+' : '−'}€{fmt(Math.abs(delta))} rispetto ad oggi
          </span>
        </div>
      </div>

      {/* Breakdown */}
      <div className="forecast-breakdown">
        <div className="forecast-breakdown-row">
          <span className="forecast-breakdown-label">Già registrato (mese)</span>
          <div className="forecast-breakdown-amounts">
            <span className="forecast-amount-income">+€{fmt(currentMonthActual.income)}</span>
            <span className="forecast-amount-expense">−€{fmt(currentMonthActual.expenses)}</span>
          </div>
        </div>
        <div className="forecast-breakdown-row">
          <span className="forecast-breakdown-label">Impegni noti rimanenti</span>
          <div className="forecast-breakdown-amounts">
            {knownRemaining.income > 0 && (
              <span className="forecast-amount-income">+€{fmt(knownRemaining.income)}</span>
            )}
            {knownRemaining.expenses > 0 && (
              <span className="forecast-amount-expense">−€{fmt(knownRemaining.expenses)}</span>
            )}
            {knownRemaining.income === 0 && knownRemaining.expenses === 0 && (
              <span className="forecast-breakdown-none">nessuno</span>
            )}
          </div>
        </div>
        {habitualRemaining.hasData && (
          <>
            <div className="forecast-breakdown-row">
              <span className="forecast-breakdown-label">
                Spese abituali stimate
              </span>
              <div className="forecast-breakdown-amounts">
                {habitualRemaining.total > 0 ? (
                  <span className="forecast-amount-expense">−€{fmt(habitualRemaining.total)}</span>
                ) : (
                  <span className="forecast-breakdown-none">nessuna</span>
                )}
              </div>
            </div>
            {habitualRemaining.categories.length > 0 && habitualRemaining.total > 0 && (
              <div className="forecast-habitual-cats">
                {habitualRemaining.categories.slice(0, 3).map((cat) => (
                  <span key={cat.categoryName} className="forecast-habitual-cat">
                    {cat.categoryName} −€{fmt(cat.estimated)}
                  </span>
                ))}
              </div>
            )}
          </>
        )}
        {!habitualRemaining.hasData && (
          <div className="forecast-breakdown-row">
            <span className="forecast-breakdown-label">Spese stimate (ritmo attuale)</span>
            <div className="forecast-breakdown-amounts">
              <span className="forecast-amount-expense">
                −€{fmt(forecast.dailyPace.expenses * daysRemaining)}
              </span>
            </div>
          </div>
        )}
        {historicalAvg.monthsConsidered > 0 && (
          <div className="forecast-breakdown-row forecast-breakdown-hist">
            <span className="forecast-breakdown-label">
              Media storica ({historicalAvg.monthsConsidered} mesi)
            </span>
            <div className="forecast-breakdown-amounts">
              <span className="forecast-amount-income">+€{fmt(historicalAvg.income)}</span>
              <span className="forecast-amount-expense">−€{fmt(historicalAvg.expenses)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
