import { Link } from 'react-router-dom';
import { AlertTriangle, Activity, Wallet, CalendarClock } from 'lucide-react';
import { useForecast } from '../../hooks/useAnalytics';
import { useFormatCurrency } from '../../hooks/useFormatCurrency';
import { SkeletonCard } from '../shared/Skeleton';

// Vista "Stima realistica" della card Andamento del saldo: da oggi al giorno
// prima del prossimo stipendio (periodo di paga, non mese solare).
//   Oggi → + entrate → − impegni (ricorrenti, pianificate, carte) → − ritmo quotidiano
//   = liquidità stimata alla vigilia dell'accredito, con fascia probabile.
// In più: punto più basso, quanto si può spendere al giorno senza andare sotto
// zero, conti che toccano il minimo, dove va il ritmo. Chrome/titolo dal genitore.

const shortDate = (iso: string) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });

const signed = (n: number, fmt: (v: number) => string) => `${n < 0 ? '−' : ''}${fmt(Math.abs(n))}`;

export default function ForecastView() {
  const { formatCurrency } = useFormatCurrency();
  const { data: forecast, isLoading, isError } = useForecast();

  if (isLoading) return <SkeletonCard />;
  if (isError) return <div className="forecast-empty">Errore nel calcolo della stima. Riprova più tardi.</div>;
  if (!forecast) return <div className="forecast-empty">Nessun dato disponibile per la stima.</div>;

  const { payPeriod, eveDate, daysRemaining, currentBalance, known, rhythm, atEve, lowest, spendablePerDay, accounts } = forecast;
  const progress = Math.min(100, Math.round((payPeriod.daysElapsed / payPeriod.daysTotal) * 100));
  const hasRhythm = rhythm.basis !== 'none';
  const hasBand = hasRhythm && atEve.low !== atEve.high;
  const low = hasRhythm ? lowest.withRhythm : lowest.standard;
  const accountMins = accounts.filter((a) => (hasRhythm ? a.rhythmMin : a.standardMin) != null);
  const paceDelta = rhythm.current.rate - rhythm.dailyRate;

  return (
    <>
      <p className="forecast-caption">
        {payPeriod.configured
          ? `Fino al prossimo stipendio (${shortDate(payPeriod.nextPayday)}): impegni noti + ritmo quotidiano stimato`
          : 'Fino a fine mese: imposta il periodo di paga per ragionare da stipendio a stipendio'}
      </p>
      {!payPeriod.configured && (
        <Link to="/profile#preferenze" className="forecast-setup-link">
          <CalendarClock size={13} /> Imposta il periodo di paga
        </Link>
      )}

      {/* ── Avanzamento del periodo di paga ── */}
      <div className="forecast-progress-bar">
        <div className="forecast-progress-fill" style={{ width: `${progress}%` }} />
      </div>
      <div className="forecast-progress-labels">
        <span>Giorno {payPeriod.daysElapsed} di {payPeriod.daysTotal}</span>
        <span>
          {payPeriod.daysToPayday > 1
            ? `${payPeriod.daysToPayday} giorni allo stipendio`
            : payPeriod.daysToPayday === 1 ? 'stipendio domani' : 'stipendio oggi'}
        </span>
      </div>

      {/* ── Risultato: liquidità alla vigilia dell'accredito ── */}
      <div className="forecast-result">
        <span className="forecast-result-label">Liquidità stimata il {shortDate(eveDate)}</span>
        <div className="forecast-result-row">
          <span className={`forecast-result-value${atEve.withRhythm < 0 ? ' is-negative' : ''}`}>
            {signed(atEve.withRhythm, formatCurrency)}
          </span>
          {hasBand && (
            <span className="forecast-result-range">
              fascia {signed(atEve.low, formatCurrency)} – {signed(atEve.high, formatCurrency)}
            </span>
          )}
        </div>
        <span className="forecast-result-sub">
          Solo impegni noti: {signed(atEve.standard, formatCurrency)}
        </span>
      </div>

      {/* ── Waterfall: da oggi alla vigilia dello stipendio ── */}
      <div className="forecast-waterfall">
        <div className="forecast-wf-row is-start">
          <span className="forecast-wf-label">Saldo di oggi</span>
          <span className="forecast-wf-amount">{formatCurrency(currentBalance)}</span>
        </div>
        <div className="forecast-wf-row">
          <span className="forecast-wf-label">Entrate previste</span>
          <span className="forecast-wf-amount is-income">+{formatCurrency(known.income)}</span>
        </div>
        <div className="forecast-wf-row">
          <span className="forecast-wf-label">Impegni (ricorrenti, pianificate, carte)</span>
          <span className="forecast-wf-amount is-expense">−{formatCurrency(known.expenses)}</span>
        </div>
        <div className="forecast-wf-row">
          <span className="forecast-wf-label">
            Ritmo quotidiano
            {hasRhythm && daysRemaining > 0 && (
              <span className="forecast-wf-hint"> · {formatCurrency(rhythm.dailyRate)}/giorno × {daysRemaining} gg</span>
            )}
          </span>
          <span className="forecast-wf-amount is-expense">−{formatCurrency(rhythm.remaining)}</span>
        </div>
        <div className="forecast-wf-row is-total">
          <span className="forecast-wf-label">Stima al {shortDate(eveDate)}</span>
          <span className={`forecast-wf-amount${atEve.withRhythm < 0 ? ' is-expense' : ''}`}>
            {signed(atEve.withRhythm, formatCurrency)}
          </span>
        </div>
      </div>

      {!hasRhythm && (
        <p className="forecast-note">
          Ritmo quotidiano non ancora stimabile: servono almeno 7 giorni di spese registrate.
        </p>
      )}

      {/* ── Indicatori ── */}
      <div className="forecast-insights">
        {low && daysRemaining > 0 && (
          <div className={`forecast-insight${low.value < 0 ? ' is-danger' : ''}`}>
            <span className="forecast-insight-icon">
              {low.value < 0 ? <AlertTriangle size={14} /> : <Activity size={14} />}
            </span>
            <span className="forecast-insight-label">Punto più basso</span>
            <span className="forecast-insight-value">{signed(low.value, formatCurrency)}</span>
            <span className="forecast-insight-meta">il {shortDate(low.date)}</span>
          </div>
        )}
        {spendablePerDay !== null && (
          <div className="forecast-insight">
            <span className="forecast-insight-icon"><Wallet size={14} /></span>
            <span className="forecast-insight-label">Spendibile al giorno</span>
            <span className="forecast-insight-value">{formatCurrency(spendablePerDay)}</span>
            <span className="forecast-insight-meta">senza andare sotto zero</span>
          </div>
        )}
        {hasRhythm && rhythm.basis === 'periods' && (
          <div className={`forecast-insight${paceDelta > 0.5 ? ' is-warning' : ''}`}>
            <span className="forecast-insight-icon"><Activity size={14} /></span>
            <span className="forecast-insight-label">Ritmo di questo periodo</span>
            <span className="forecast-insight-value">{formatCurrency(rhythm.current.rate)}/g</span>
            <span className="forecast-insight-meta">abituale {formatCurrency(rhythm.dailyRate)}/g</span>
          </div>
        )}
      </div>

      {/* ── Minimo per conto (senza fido conta il singolo conto) ── */}
      {accountMins.length > 0 && (
        <div className="forecast-accounts">
          <div className="forecast-frequent-header">Punto più basso per conto</div>
          <ul className="forecast-account-list">
            {accountMins.map((a) => {
              const m = (hasRhythm ? a.rhythmMin : a.standardMin)!;
              return (
                <li key={a.id} className={`forecast-account-item${m.value < 0 ? ' is-danger' : ''}`}>
                  <span className="forecast-account-dot" style={{ background: a.color ?? '#a8a29e' }} />
                  <span className="forecast-account-name">{a.name}</span>
                  <span className="forecast-account-date">{shortDate(m.date)}</span>
                  <span className="forecast-account-value">{signed(m.value, formatCurrency)}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* ── Dove va il ritmo ── */}
      {hasRhythm && rhythm.topCategories.length > 0 && (
        <div className="forecast-frequent">
          <div className="forecast-frequent-header">Dove va il ritmo quotidiano</div>
          <div className="forecast-frequent-list">
            {rhythm.topCategories.slice(0, 4).map((c) => (
              <div key={c.categoryId ?? c.name} className="forecast-frequent-item">
                <span
                  className="forecast-frequent-icon"
                  style={{ backgroundColor: (c.color ?? '#0d9488') + '22', color: c.color ?? '#0d9488' }}
                >
                  {c.icon || '•'}
                </span>
                <span className="forecast-frequent-name">{c.name}</span>
                <span className="forecast-frequent-freq">{Math.round(c.share * 100)}%</span>
                <span className="forecast-frequent-amount">~{formatCurrency(c.daily)}/g</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
