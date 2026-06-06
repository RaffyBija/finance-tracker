import { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { useCalendar } from '../hooks/useCalendar';
import type { CalendarDay, CalendarEvent } from '../api/calendar';
import { useFormatCurrency } from '../hooks/useFormatCurrency';

const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
const MONTHS   = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
                  'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
const MONTHS_S = ['gen','feb','mar','apr','mag','giu','lug','ago','set','ott','nov','dic'];


function barH(amount: number, max: number): number {
  if (amount <= 0 || max <= 0) return 0;
  return Math.max(4, Math.min(28, (amount / max) * 28));
}

export default function CalendarPage() {
  const { formatCurrency } = useFormatCurrency();
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

  const toStr = (d: number) =>
    `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;

  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

  const maxAmount = Math.max(
    ...Object.values(data?.days || {}).flatMap(d => [d.income, d.expenses]),
    100,
  );

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
            <button className="btn btn-ghost cal-nav-btn" onClick={nextMonth} aria-label="Mese successivo">
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Legend */}
          <div className="cal-legend">
            <span className="cal-legend-item">
              <span className="cal-legend-dot cal-dot-income" />
              Entrate
            </span>
            <span className="cal-legend-item">
              <span className="cal-legend-dot cal-dot-expense" />
              Uscite
            </span>
            <span className="cal-legend-item">
              <span className="cal-legend-dot cal-dot-planned" />
              Pianificate
            </span>
            <span className="cal-legend-item">
              <span className="cal-legend-dot cal-dot-recurring" />
              Ricorrenti
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
                const dateStr = toStr(day);
                const dd      = data?.days[dateStr];
                const isToday = dateStr === todayStr;
                const isSel   = dateStr === selected;
                const net     = (dd?.income || 0) - (dd?.expenses || 0);

                return (
                  <button
                    key={dateStr}
                    onClick={() => setSelected(isSel ? null : dateStr)}
                    className={[
                      'cal-cell',
                      isToday ? 'is-today' : '',
                      isSel   ? 'is-selected' : '',
                      dd      ? 'has-data' : '',
                    ].filter(Boolean).join(' ')}
                  >
                    <span className="cal-cell-num">{day}</span>
                    {dd && (
                      <div className="cal-cell-bars">
                        <div className="cal-bar cal-bar-income"  style={{ height: `${barH(dd.income,   maxAmount)}px` }} />
                        <div className="cal-bar cal-bar-expense" style={{ height: `${barH(dd.expenses, maxAmount)}px` }} />
                      </div>
                    )}
                    {dd && (
                      <span className={`cal-cell-net${net >= 0 ? ' pos' : ' neg'}`}>
                        {net > 0 ? '+' : ''}{formatCurrency(net)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

        </div>

        {/* ─── Detail column ─── */}
        <div ref={detailRef} className={`cal-detail${selectedDay ? ' is-visible' : ''}`}>
          {selected && selectedDay
            ? <DayDetail date={selected} day={selectedDay} balance={selectedBalance} />
            : (
              <div className="cal-detail-empty">
                <CalendarDays size={32} className="cal-detail-empty-icon" />
                <p>Seleziona un giorno per vedere le transazioni</p>
              </div>
            )
          }
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
    const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
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
  const { formatCurrency } = useFormatCurrency();
  const [y, m, d] = date.split('-').map(Number);
  const net       = day.income - day.expenses;

  return (
    <div className="cal-detail-inner">
      <div className="cal-detail-header">
        <h3 className="cal-detail-date">{d} {MONTHS_S[m - 1]} {y}</h3>
        <div className="cal-detail-kpis">
          {day.income   > 0 && <span className="cal-kpi cal-kpi-income">+{formatCurrency(day.income)}</span>}
          {day.expenses > 0 && <span className="cal-kpi cal-kpi-expense">-{formatCurrency(day.expenses)}</span>}
          {day.income > 0 && day.expenses > 0 && (
            <span className={`cal-kpi cal-kpi-net${net >= 0 ? ' pos' : ' neg'}`}>
              {net > 0 ? '+' : ''}{formatCurrency(net)}
            </span>
          )}
        </div>
        {balance !== null && (
          <div className={`cal-detail-balance${balance >= 0 ? ' pos' : ' neg'}`}>
            Saldo a fine giornata: <strong>{formatCurrency(balance)}</strong>
          </div>
        )}
      </div>
      <div className="cal-events-list">
        {day.events.map(ev => <EventRow key={ev.id} event={ev} />)}
      </div>
    </div>
  );
}

function EventRow({ event }: { event: CalendarEvent }) {
  const { formatCurrency } = useFormatCurrency();
  const isIncome = event.transactionType === 'INCOME';
  const sourceLabel: Record<CalendarEvent['source'], string> = {
    actual:    'Effettiva',
    planned:   'Pianificata',
    recurring: 'Ricorrente',
  };

  return (
    <div className={`cal-event${isIncome ? ' is-income' : ' is-expense'}`}>
      <div className={`cal-event-stripe cal-stripe-${event.source}`} />
      <div className="cal-event-body">
        {event.category?.icon && (
          <span className="cal-event-icon">{event.category.icon}</span>
        )}
        <div className="cal-event-info">
          <span className="cal-event-desc">
            {event.description || event.category?.name || '—'}
          </span>
          <div className="cal-event-meta">
            <span className={`cal-event-badge cal-badge-${event.source}`}>
              {sourceLabel[event.source]}
            </span>
            {event.category?.name && (
              <span className="cal-event-cat">{event.category.name}</span>
            )}
          </div>
        </div>
      </div>
      <span className={`cal-event-amount${isIncome ? ' pos' : ' neg'}`}>
        {isIncome ? '+' : '-'}{formatCurrency(event.amount)}
      </span>
    </div>
  );
}
