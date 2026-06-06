import { TrendingUp, TrendingDown, Repeat } from 'lucide-react';
import { useForecast } from '../../hooks/useAnalytics';
import { useFormatCurrency } from '../../hooks/useFormatCurrency';

// Vista "Stima realistica" della card Andamento del saldo.
// Layout a waterfall: Oggi → +entrate → −spese fisse → −spese abituali → fine mese.
// In più, le spese ricorrenti più frequenti (per numero di movimenti) con icona.
// Orizzonte fisso a fine mese corrente. Chrome/titolo dal genitore.


function ForecastSkeleton() {
  return (
    <div className="animate-pulse">
      <div style={{ height: '0.625rem', width: '12rem', background: '#e7e5e4', borderRadius: '0.25rem', marginBottom: '1rem' }} />
      <div style={{ background: '#fafaf9', borderRadius: '0.75rem', padding: '1.25rem', marginBottom: '1rem' }}>
        <div style={{ height: '0.625rem', width: '8rem', background: '#e7e5e4', borderRadius: '0.25rem', marginBottom: '0.5rem' }} />
        <div style={{ height: '1.75rem', width: '9rem', background: '#e7e5e4', borderRadius: '0.25rem' }} />
      </div>
    </div>
  );
}

export default function ForecastView() {
  const { formatCurrency } = useFormatCurrency();
  const { data: forecast, isLoading } = useForecast();

  if (isLoading) return <ForecastSkeleton />;
  if (!forecast) {
    return (
      <div style={{ textAlign: 'center', padding: '1.5rem 0', color: '#a8a29e', fontSize: '0.875rem' }}>
        Nessun dato disponibile per la stima.
      </div>
    );
  }

  const {
    daysElapsed,
    daysInMonth,
    daysRemaining,
    currentBalance,
    knownRemaining,
    habitualRemaining,
    frequentExpenses,
    dailyPace,
    projectedEndBalance,
  } = forecast;

  const isPositive = projectedEndBalance >= currentBalance;
  const delta = projectedEndBalance - currentBalance;

  // La spesa abituale stimata: storico per categoria se disponibile, altrimenti ritmo attuale.
  const habitualExpense = habitualRemaining.hasData
    ? habitualRemaining.total
    : dailyPace.expenses * daysRemaining;

  const monthProgress = Math.min(100, Math.round((daysElapsed / daysInMonth) * 100));

  return (
    <>
      <p className="forecast-caption">
        Stima a fine mese: impegni certi + spese abituali (escluse le ricorrenti già contate)
      </p>

      {/* ── Avanzamento del mese ── */}
      <div className="forecast-progress-bar">
        <div className="forecast-progress-fill" style={{ width: `${monthProgress}%` }} />
      </div>
      <div className="forecast-progress-labels">
        <span>Giorno {daysElapsed} di {daysInMonth}</span>
        <span>{daysRemaining > 0 ? `${daysRemaining} giorni rimanenti` : 'ultimo giorno'}</span>
      </div>

      {/* ── Risultato: saldo stimato a fine mese ── */}
      <div className="forecast-result">
        <span className="forecast-result-label">Saldo stimato a fine mese</span>
        <div className="forecast-result-row">
          <span className={`forecast-result-value${projectedEndBalance < 0 ? ' is-negative' : ''}`}>
            {projectedEndBalance >= 0 ? '+' : '−'}{formatCurrency(Math.abs(projectedEndBalance))}
          </span>
          <span className={`forecast-result-delta${isPositive ? ' is-positive' : ' is-negative'}`}>
            {isPositive ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
            {isPositive ? '+' : '−'}{formatCurrency(Math.abs(delta))} vs oggi
          </span>
        </div>
      </div>

      {/* ── Waterfall: dal saldo di oggi a quello di fine mese ── */}
      <div className="forecast-waterfall">
        <div className="forecast-wf-row is-start">
          <span className="forecast-wf-label">Saldo di oggi</span>
          <span className="forecast-wf-amount">{formatCurrency(currentBalance)}</span>
        </div>
        <div className="forecast-wf-row">
          <span className="forecast-wf-label">Entrate previste</span>
          <span className="forecast-wf-amount is-income">+{formatCurrency(knownRemaining.income)}</span>
        </div>
        <div className="forecast-wf-row">
          <span className="forecast-wf-label">Spese fisse (ricorrenti + pianificate)</span>
          <span className="forecast-wf-amount is-expense">−{formatCurrency(knownRemaining.expenses)}</span>
        </div>
        <div className="forecast-wf-row">
          <span className="forecast-wf-label">Spese abituali stimate</span>
          <span className="forecast-wf-amount is-expense">−{formatCurrency(habitualExpense)}</span>
        </div>
        <div className="forecast-wf-row is-total">
          <span className="forecast-wf-label">Saldo a fine mese</span>
          <span className={`forecast-wf-amount${projectedEndBalance < 0 ? ' is-expense' : ''}`}>
            {formatCurrency(projectedEndBalance)}
          </span>
        </div>
      </div>

      {/* ── Spese ricorrenti più frequenti ── */}
      {frequentExpenses.length > 0 && (
        <div className="forecast-frequent">
          <div className="forecast-frequent-header">
            <Repeat size={13} />
            Spese più frequenti
          </div>
          <div className="forecast-frequent-list">
            {frequentExpenses.slice(0, 4).map((c) => (
              <div key={c.categoryId ?? c.categoryName} className="forecast-frequent-item">
                <span
                  className="forecast-frequent-icon"
                  style={{ backgroundColor: (c.color ?? '#0d9488') + '22', color: c.color ?? '#0d9488' }}
                >
                  {c.icon || '•'}
                </span>
                <span className="forecast-frequent-name">{c.categoryName}</span>
                <span className="forecast-frequent-freq">
                  ~{c.perMonth}×/mese
                </span>
                <span className="forecast-frequent-amount">~{formatCurrency(c.avgMonthly)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
