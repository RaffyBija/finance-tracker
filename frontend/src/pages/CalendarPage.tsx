import { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { useCalendar } from '../hooks/useCalendar';
import type { CalendarDay, CalendarEvent } from '../api/calendar';
import { useFormatCurrency } from '../hooks/useFormatCurrency';

const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
const MONTHS   = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
                  'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
const MONTHS_S = ['gen','feb','mar','apr','mag','giu','lug','ago','set','ott','nov','dic'];

const pad = (n: number) => String(n).padStart(2, '0');

// Cifra compatta firmata per la cella su mobile, dove l'importo esteso non entra.
// Notazione k/M neutra: l'importo esatto resta nel dettaglio del giorno (al tap).
function compactSigned(net: number): string {
  if (net === 0) return '0';
  const sign = net > 0 ? '+' : '−';
  const abs  = Math.abs(net);
  let body: string;
  if (abs >= 1_000_000)  body = (abs / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1).replace(/[.,]0$/, '').replace('.', ',') + 'M';
  else if (abs >= 1_000) body = (abs / 1_000).toFixed(abs >= 10_000 ? 0 : 1).replace(/[.,]0$/, '').replace('.', ',') + 'k';
  else                   body = String(Math.round(abs));
  return sign + body;
}

export default function CalendarPage() {
  const { formatCurrency, formatSignedCurrency } = useFormatCurrency();
  const today    = new Date();
  const [year, setYear]   = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1); // 1-indexed
  const [selected, setSelected] = useState<string | null>(null);
  const detailRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useCalendar(year, month);

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
    setSelected(null);
  };
  const nextMonth = () => {
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
    setSelected(null);
  };
  const goToday = () => {
    setYear(today.getFullYear());
    setMonth(today.getMonth() + 1);
    setSelected(null);
  };

  useEffect(() => {
    if (selected && detailRef.current) {
      detailRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [selected]);

  // Build calendar grid (Mon-first)
  const firstDow  = (new Date(year, month - 1, 1).getDay() + 6) % 7;
  const daysInMo  = new Date(year, month, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMo }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const toStr = (d: number) => `${year}-${pad(month)}-${pad(d)}`;
  const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth() + 1;

  // Riepilogo del mese: somma dei movimenti mostrati nella griglia (tutte le fonti).
  const summary = useMemo(() => {
    let income = 0, expenses = 0;
    for (const d of Object.values(data?.days || {})) {
      income   += d.income;
      expenses += d.expenses;
    }
    return { income, expenses, net: income - expenses };
  }, [data]);

  // Picco di movimento (entrate+uscite) del mese → intensità della tinta-attività.
  // La cella si scurisce con il volume di movimenti, non con il segno del netto:
  // un giorno denso che si compensa resta scuro (= da controllare nell'audit).
  const maxTurnover = useMemo(() => {
    let m = 0;
    for (const d of Object.values(data?.days || {})) {
      const t = d.income + d.expenses;
      if (t > m) m = t;
    }
    return m;
  }, [data]);

  const selectedDay = selected ? data?.days[selected] : null;
  const selectedBalance = selected && data
    ? computeRunningBalance(data.openingBalance, data.days, selected)
    : null;

  return (
    <div className="container-custom">
      <div className="page-header">
        <div>
          <h1 className="page-header-title">Calendario Cash Flow</h1>
          <p className="page-header-subtitle">Transazioni effettive, pianificate e ricorrenti per giorno</p>
        </div>
      </div>

      <div className="cal-wrap">

        {/* ─── Calendar column ─── */}
        <div className="cal-col">

          {/* Month nav */}
          <div className="cal-nav">
            <button className="btn btn-ghost cal-nav-btn" onClick={prevMonth} aria-label="Mese precedente">
              <ChevronLeft size={18} />
            </button>
            <h2 className="cal-nav-month">{MONTHS[month - 1]} {year}</h2>
            <div className="cal-nav-actions">
              {!isCurrentMonth && (
                <button className="btn btn-ghost cal-today-btn" onClick={goToday}>Oggi</button>
              )}
              <button className="btn btn-ghost cal-nav-btn" onClick={nextMonth} aria-label="Mese successivo">
                <ChevronRight size={18} />
              </button>
            </div>
          </div>

          {/* Month summary: framing the audit, not a second chart */}
          {data && (
            <div className="cal-summary">
              <div className="cal-summary-item">
                <span className="cal-summary-label">Entrate</span>
                <span className="cal-summary-val pos">{formatSignedCurrency(summary.income, 'INCOME')}</span>
              </div>
              <div className="cal-summary-item">
                <span className="cal-summary-label">Uscite</span>
                <span className="cal-summary-val neg">{formatSignedCurrency(summary.expenses, 'EXPENSE')}</span>
              </div>
              <div className="cal-summary-item">
                <span className="cal-summary-label">Netto</span>
                <span className={`cal-summary-val ${summary.net >= 0 ? 'pos' : 'neg'}`}>
                  {formatSignedCurrency(Math.abs(summary.net), summary.net >= 0 ? 'INCOME' : 'EXPENSE')}
                </span>
              </div>
            </div>
          )}

          {/* Legend: explains the cell encoding (intensity = volume, colour = direction) */}
          <div className="cal-legend">
            <span className="cal-legend-item">
              <span className="cal-legend-scale" aria-hidden="true" />
              Più scuro = più movimenti
            </span>
            <span className="cal-legend-item">
              <span className="cal-legend-figure pos">+</span>
              <span className="cal-legend-figure neg">−</span>
              Saldo del giorno
            </span>
          </div>

          {/* Grid */}
          <div className={`cal-grid-wrap${isLoading ? ' is-loading' : ''}`}>
            <div className="cal-weekdays">
              {WEEKDAYS.map(w => <div key={w} className="cal-weekday">{w}</div>)}
            </div>
            <div className="cal-grid">
              {cells.map((day, i) => {
                if (!day) return <div key={`e-${i}`} className="cal-cell cal-cell-empty" />;
                const dateStr  = toStr(day);
                const dd       = data?.days[dateStr];
                const isToday  = dateStr === todayStr;
                const isSel    = dateStr === selected;
                const net      = dd ? dd.income - dd.expenses : 0;
                const turnover = dd ? dd.income + dd.expenses : 0;
                const hasData  = turnover > 0;
                const netClass = !hasData ? '' : net > 0 ? 'pos' : net < 0 ? 'neg' : 'zero';
                // Intensità ∝ volume di movimenti, con un minimo percepibile.
                const act = hasData && maxTurnover > 0
                  ? Math.min(1, Math.max(0.18, turnover / maxTurnover))
                  : 0;

                return (
                  <button
                    key={dateStr}
                    onClick={() => setSelected(isSel ? null : dateStr)}
                    className={['cal-cell', hasData ? 'has-activity' : '', isToday ? 'is-today' : '', isSel ? 'is-selected' : '']
                      .filter(Boolean).join(' ')}
                    style={act ? ({ '--act': act } as React.CSSProperties) : undefined}
                    aria-label={hasData
                      ? `${day} ${MONTHS_S[month - 1]}, saldo del giorno ${net === 0 ? formatCurrency(0) : formatSignedCurrency(Math.abs(net), net > 0 ? 'INCOME' : 'EXPENSE')}`
                      : `${day} ${MONTHS_S[month - 1]}, nessun movimento`}
                  >
                    <span className="cal-cell-num">{day}</span>
                    {hasData && (
                      <>
                        <span className={`cal-cell-net cal-cell-net-full ${netClass}`}>
                          {net === 0 ? formatCurrency(0) : formatSignedCurrency(Math.abs(net), net > 0 ? 'INCOME' : 'EXPENSE')}
                        </span>
                        <span className={`cal-cell-net cal-cell-net-compact ${netClass}`} aria-hidden="true">
                          {compactSigned(net)}
                        </span>
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

        </div>

        {/* ─── Detail column ─── */}
        <div ref={detailRef} className={`cal-detail${selected ? ' is-visible' : ''}`}>
          {!selected ? (
            <div className="cal-detail-empty">
              <CalendarDays size={32} className="cal-detail-empty-icon" />
              <p>Seleziona un giorno per vederne i movimenti</p>
            </div>
          ) : selectedDay ? (
            <DayDetail date={selected} day={selectedDay} balance={selectedBalance} />
          ) : (
            <NoMovementsDetail date={selected} balance={selectedBalance} />
          )}
        </div>

      </div>
    </div>
  );
}

function computeRunningBalance(
  openingBalance: number,
  days: Record<string, import('../api/calendar').CalendarDay>,
  upToDate: string,
): number {
  const [y, m, d] = upToDate.split('-').map(Number);
  let balance = openingBalance;
  for (let day = 1; day <= d; day++) {
    const dateStr = `${y}-${pad(m)}-${pad(day)}`;
    const dayData = days[dateStr];
    if (!dayData) continue;
    for (const ev of dayData.events) {
      if (ev.source !== 'actual') continue;
      if (ev.transactionType === 'INCOME') balance += ev.amount;
      else balance -= ev.amount;
    }
  }
  return balance;
}

function DayDetail({ date, day, balance }: { date: string; day: CalendarDay; balance: number | null }) {
  const { formatCurrency, formatSignedCurrency } = useFormatCurrency();
  const [y, m, d] = date.split('-').map(Number);
  const net       = day.income - day.expenses;
  const count     = day.events.length;

  return (
    <div className="cal-detail-inner">
      <div className="cal-detail-header">
        <h3 className="cal-detail-date">{d} {MONTHS_S[m - 1]} {y}</h3>
        <div className="cal-detail-kpis">
          {day.income   > 0 && <span className="cal-kpi cal-kpi-income">{formatSignedCurrency(day.income, 'INCOME')}</span>}
          {day.expenses > 0 && <span className="cal-kpi cal-kpi-expense">{formatSignedCurrency(day.expenses, 'EXPENSE')}</span>}
          {day.income > 0 && day.expenses > 0 && (
            <span className={`cal-kpi cal-kpi-net ${net >= 0 ? 'pos' : 'neg'}`}>
              {net === 0 ? formatCurrency(0) : formatSignedCurrency(Math.abs(net), net > 0 ? 'INCOME' : 'EXPENSE')}
            </span>
          )}
        </div>
        {balance !== null && (
          <div className={`cal-detail-balance${balance >= 0 ? ' pos' : ' neg'}`}>
            Saldo a fine giornata: <strong>{formatCurrency(balance)}</strong>
          </div>
        )}
      </div>
      <div className="cal-events-count">{count} {count === 1 ? 'movimento' : 'movimenti'}</div>
      <div className="cal-events-list">
        {day.events.map(ev => <EventRow key={ev.id} event={ev} />)}
      </div>
    </div>
  );
}

function NoMovementsDetail({ date, balance }: { date: string; balance: number | null }) {
  const { formatCurrency } = useFormatCurrency();
  const [y, m, d] = date.split('-').map(Number);

  return (
    <div className="cal-detail-inner">
      <div className="cal-detail-header">
        <h3 className="cal-detail-date">{d} {MONTHS_S[m - 1]} {y}</h3>
        {balance !== null && (
          <div className={`cal-detail-balance${balance >= 0 ? ' pos' : ' neg'}`}>
            Saldo a fine giornata: <strong>{formatCurrency(balance)}</strong>
          </div>
        )}
      </div>
      <div className="cal-detail-nomov">Nessun movimento in questo giorno.</div>
    </div>
  );
}

function EventRow({ event }: { event: CalendarEvent }) {
  const { formatSignedCurrency } = useFormatCurrency();
  const isIncome = event.transactionType === 'INCOME';
  const sourceLabel: Record<CalendarEvent['source'], string> = {
    actual:    'Effettiva',
    planned:   'Pianificata',
    recurring: 'Ricorrente',
  };

  return (
    <div className="cal-event">
      <div className="cal-event-body">
        {event.category?.icon && (
          <span className="cal-event-icon">{event.category.icon}</span>
        )}
        <div className="cal-event-info">
          <span className="cal-event-desc">
            {event.description || event.category?.name || '—'}
          </span>
          <div className="cal-event-meta">
            <span className="cal-event-badge">{sourceLabel[event.source]}</span>
            {event.category?.name && (
              <span className="cal-event-cat">{event.category.name}</span>
            )}
          </div>
        </div>
      </div>
      <span className={`cal-event-amount${isIncome ? ' pos' : ' neg'}`}>
        {formatSignedCurrency(event.amount, event.transactionType)}
      </span>
    </div>
  );
}
