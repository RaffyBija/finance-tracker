import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { SpendingAnalysis } from '../../types';
import { useFormatCurrency } from '../../hooks/useFormatCurrency';
import { WEEKDAYS, dailySpending, frequentDescriptions, sizeDistribution, weekdayProfile } from './model';
import { useChartTheme, dayLabel, pct, periodLabel } from './ui';

// Scheda "Abitudini": COME si spende, non solo quanto.
//   • giorno della settimana (spesa variabile media, su tutti i periodi caricati);
//   • calendario del periodo scelto (intensità = spesa variabile del giorno);
//   • fasce d'importo (molte piccole spese o poche grandi?);
//   • voci ricorrenti (esercenti/descrizioni che tornano spesso).

interface Props {
  data: SpendingAnalysis;
  selected: number;
}

function WeekdayTooltip({ active, payload, formatCurrency }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="card card-md dashboard-tooltip">
      <p className="dashboard-tooltip-label">{d.day}</p>
      <p className="dashboard-tooltip-amount">{formatCurrency(d.avg)}</p>
      <p className="projection-chart-tip-tag">in media · totale {formatCurrency(d.total)}</p>
    </div>
  );
}

// Livello d'intensità (0–4) rispetto al giorno più caro del periodo.
const levelOf = (v: number, max: number) => (v <= 0 || max <= 0 ? 0 : Math.min(4, Math.ceil((v / max) * 4)));

export default function SpendingHabits({ data, selected }: Props) {
  const { formatCurrency, formatCurrencyAxis } = useFormatCurrency();
  const theme = useChartTheme();
  const allIdx = useMemo(() => data.periods.map((_, i) => i), [data]);

  const weekday = useMemo(() => weekdayProfile(data, allIdx), [data, allIdx]);
  const days = useMemo(() => dailySpending(data, selected), [data, selected]);
  const sizes = useMemo(() => sizeDistribution(data.lines), [data]);
  // Solo spese variabili: fisse e rate sono già note, qui contano le abitudini.
  const frequent = useMemo(() => frequentDescriptions(data.lines.filter((l) => l.kind === 'variable')).slice(0, 10), [data]);
  const catById = useMemo(() => new Map(data.categories.map((c) => [c.id, c.name])), [data]);

  const peak = weekday.reduce((m, d) => (d.avg > m.avg ? d : m), weekday[0]);
  const maxDay = Math.max(...days.filter((d) => !d.future).map((d) => d.variable), 0);
  const firstWeekday = (new Date(days[0]?.date + 'T00:00:00').getDay() + 6) % 7;
  const spendDays = days.filter((d) => !d.future && d.variable > 0).length;
  const pastDays = days.filter((d) => !d.future).length;
  const maxSizeShare = Math.max(...sizes.map((s) => s.share), 0);

  return (
    <div className="lens-stack">
      <div className="analysis-grid-2">
        {/* ── Giorno della settimana ── */}
        <div className="card">
          <div className="widget-head">
            <h3 className="widget-title">Giorno della settimana</h3>
          </div>
          <p className="analysis-card-lead">
            {peak && peak.avg > 0
              ? <>Spendi di più il <strong>{peak.day.toLowerCase()}</strong>: in media {formatCurrency(peak.avg)} di spese variabili.</>
              : 'Nessuna spesa variabile nei periodi caricati.'}
          </p>
          <div className="analysis-chart">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={weekday} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: theme.axis }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: theme.axis }} axisLine={false} tickLine={false} width={48} tickFormatter={(v) => formatCurrencyAxis(Number(v))} />
                <Tooltip content={<WeekdayTooltip formatCurrency={formatCurrency} />} cursor={{ fill: theme.isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' }} />
                <Bar dataKey="avg" fill={theme.kind.variable} radius={[4, 4, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── Calendario del periodo ── */}
        <div className="card">
          <div className="widget-head">
            <h3 className="widget-title">Calendario del periodo</h3>
            <span className="widget-subtitle">{periodLabel(data.periods[selected], data.mode)}</span>
          </div>
          <p className="analysis-card-lead">
            Spese variabili in <strong>{spendDays}</strong> giorni su {pastDays}
            {pastDays > 0 ? ` (${pct(spendDays / pastDays)})` : ''}.
          </p>
          <ul className="analysis-calendar" aria-label="Spesa variabile per giorno">
            {WEEKDAYS.map((w) => <li key={w} className="analysis-calendar-head" aria-hidden>{w.slice(0, 1)}</li>)}
            {Array.from({ length: firstWeekday }, (_, i) => <li key={`pad-${i}`} className="analysis-calendar-pad" aria-hidden />)}
            {days.map((d) => {
              const label = d.future
                ? `${dayLabel(d.date)}: non ancora trascorso`
                : `${dayLabel(d.date)}: variabili ${formatCurrency(d.variable)}, totale ${formatCurrency(d.total)}`;
              return (
                <li
                  key={d.date}
                  className={`analysis-calendar-day level-${d.future ? 'future' : levelOf(d.variable, maxDay)}`}
                  title={label}
                  aria-label={label}
                >
                  <span aria-hidden>{Number(d.date.slice(8))}</span>
                </li>
              );
            })}
          </ul>
          <div className="analysis-calendar-scale" aria-hidden>
            <span>meno</span>
            {[0, 1, 2, 3, 4].map((l) => <span key={l} className={`analysis-calendar-swatch level-${l}`} />)}
            <span>più</span>
          </div>
        </div>
      </div>

      <div className="analysis-grid-2">
        {/* ── Fasce d'importo ── */}
        <div className="card">
          <div className="widget-head">
            <h3 className="widget-title">Fasce d'importo</h3>
            <span className="widget-subtitle">spese variabili, tutti i periodi</span>
          </div>
          <ul className="analysis-bars">
            {sizes.map((s) => (
              <li key={s.label} className="analysis-bar-row">
                <span className="analysis-bar-label">{s.label}</span>
                <span className="analysis-bar-track">
                  <span className="analysis-bar-fill" style={{ width: maxSizeShare > 0 ? `${(s.share / maxSizeShare) * 100}%` : 0, backgroundColor: theme.kind.variable }} />
                </span>
                <span className="analysis-bar-value">{formatCurrency(s.total)}</span>
                <span className="analysis-bar-meta">{s.count} · {pct(s.share)}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* ── Voci ricorrenti ── */}
        <div className="card">
          <div className="widget-head">
            <h3 className="widget-title">Voci che tornano spesso</h3>
            <span className="widget-subtitle">spese variabili, per importo totale</span>
          </div>
          {frequent.length === 0 ? (
            <p className="analysis-card-lead">Nessuna descrizione ripetuta: aggiungi una descrizione alle spese per riconoscere le abitudini.</p>
          ) : (
            <ul className="analysis-frequent">
              {frequent.map((f) => (
                <li key={f.key} className="analysis-frequent-item">
                  <span className="analysis-frequent-body">
                    <span className="analysis-frequent-name">{f.label}</span>
                    <span className="analysis-frequent-meta">
                      {f.count} volte · media {formatCurrency(f.avg)}
                      {f.categoryId && catById.get(f.categoryId) ? ` · ${catById.get(f.categoryId)}` : ''}
                    </span>
                  </span>
                  <span className="analysis-frequent-total">{formatCurrency(f.total)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
