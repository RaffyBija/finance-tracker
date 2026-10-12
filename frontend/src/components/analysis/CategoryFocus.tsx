import { useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { SpendingAnalysis } from '../../types';
import type { ChartTooltipProps, FormatCurrency } from '../../types/chart';
import { useFormatCurrency } from '../../hooks/useFormatCurrency';
import { useCategories } from '../../hooks/useCategories';
import CategoryPicker from '../categories/CategoryPicker';
import {
  dayOffset, focusBuckets, focusDelta, focusPurchases, focusSummary, linesIn, matchesFocus, topDescriptions, weekRanges,
} from './model';
import { useChartTheme, periodLabel, periodAxisLabel, spendTone } from './ui';
import { signOf, type Tone } from '../patrimonio/tone';

// "Focus categoria": quanto spesso compro X e quanto spendo?
//   Vista a pieno pannello dentro la scheda Categorie (si apre dal bottone nella
//   barra o dal dettaglio di una categoria; "Torna alle categorie" chiude).
//   Il periodo è quello scelto in cima alla pagina; l'ambito "Tutti i periodi"
//   mostra invece una barra per periodo (di paga o mese) su tutto l'orizzonte
//   caricato. Dati: le stesse righe di /analytics/spending, quindi le spese su carta
//   contano alla data d'acquisto, trasferimenti e "Pagamento Carta" sono esclusi e
//   le righe di split cadono sulla categoria giusta.

interface Props {
  data: SpendingAnalysis;
  selected: number;
  initialCategoryId: string;
  onBack: () => void;
}

type Scope = 'period' | 'all';

interface ChartRow { label: string; range: string; count: number; total: number }

const shortDay = (iso: string) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });

function FocusTooltip({ active, payload, formatCurrency }: ChartTooltipProps<ChartRow> & { formatCurrency: FormatCurrency }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="card card-md dashboard-tooltip">
      <p className="dashboard-tooltip-label">{d.range}</p>
      <p className="dashboard-tooltip-amount">{d.count} {d.count === 1 ? 'transazione' : 'transazioni'}</p>
      <p className="projection-chart-tip-tag">spesa {formatCurrency(d.total)}</p>
    </div>
  );
}

const deltaMeta = (text: string | null, tone: Tone) =>
  text === null ? null : (
    <span className={`patrimonio-stat-meta${tone !== 'neutral' ? ` is-${tone}` : ''}`}>{text}</span>
  );

export default function CategoryFocus({ data, selected, initialCategoryId, onBack }: Props) {
  const { formatCurrency, formatCurrencyAxis } = useFormatCurrency();
  const theme = useChartTheme();
  const { data: categories = [] } = useCategories('EXPENSE', true);
  const [categoryId, setCategoryId] = useState(initialCategoryId);
  const [scope, setScope] = useState<Scope>('period');

  const period = data.periods[selected];
  const countColor = theme.isDark ? '#14b8a6' : '#0d9488';   // teal: il colore primario dell'app
  const spendColor = theme.isDark ? '#f59e0b' : '#d97706';   // ambra: la spesa

  const view = useMemo(() => {
    if (!categoryId) return null;
    const mine = data.lines.filter((l) => matchesFocus(data, l, categoryId));
    const lines = scope === 'period' ? linesIn(mine, period) : mine;
    const purchases = focusPurchases(lines);
    const rows: ChartRow[] = scope === 'all'
      ? focusBuckets(purchases, data.periods).map((b, i) => ({
        label: periodAxisLabel(data.periods[i], data.mode),
        range: periodLabel(data.periods[i], data.mode),
        count: b.count,
        total: b.total,
      }))
      : focusBuckets(purchases, weekRanges(period)).map((b) => ({
        label: shortDay(b.start),
        range: b.start === b.last ? shortDay(b.start) : `${shortDay(b.start)} – ${shortDay(b.last)}`,
        count: b.count,
        total: b.total,
      }));
    return {
      summary: focusSummary(purchases),
      rows,
      top: topDescriptions(lines),
      delta: scope === 'period' ? focusDelta(data, categoryId, selected) : null,
    };
  }, [data, categoryId, scope, period, selected]);

  const category = data.categories.find((c) => c.id === categoryId);
  const scopeLabel = scope === 'period' ? periodLabel(period, data.mode) : 'tutti i periodi caricati';
  const s = view?.summary;
  const daysAgo = s?.lastDate ? dayOffset(s.lastDate, data.today) : null;
  const d = view?.delta ?? null;
  const vsPrev = period.isCurrent ? 'vs prec. alla stessa data' : 'vs periodo prec.';

  return (
    <div className="lens-stack">
      <div className="analysis-toolbar">
        <button type="button" className="outlook-detail-link analysis-focus-back" onClick={onBack}>
          <ArrowLeft size={14} aria-hidden />
          Torna alle categorie
        </button>
        <div className="projection-pills" role="group" aria-label="Ambito">
          <button type="button" className={`projection-pill${scope === 'period' ? ' is-active' : ''}`} aria-pressed={scope === 'period'} onClick={() => setScope('period')}>Periodo scelto</button>
          <button type="button" className={`projection-pill${scope === 'all' ? ' is-active' : ''}`} aria-pressed={scope === 'all'} onClick={() => setScope('all')}>Tutti i periodi</button>
        </div>
      </div>

      <div className="card analysis-focus-picker">
        <CategoryPicker
          categories={categories}
          type="EXPENSE"
          value={categoryId}
          onChange={setCategoryId}
          label="Categoria da osservare"
          placeholder="Scegli una categoria"
          allowCreate={false}
        />
        <p className="analysis-chart-note">Una macro-categoria include le sue sotto-categorie.</p>
      </div>

      {!view || !s ? (
        <div className="card dashboard-chart-empty">Scegli una categoria per vedere ogni quanto compri e quanto spendi.</div>
      ) : s.count === 0 ? (
        <div className="card dashboard-chart-empty">
          Nessuna transazione{category ? ` in «${category.name}»` : ''} {scope === 'period' ? 'in questo periodo' : 'nei periodi caricati'}.
        </div>
      ) : (
        <>
          <div className="patrimonio-stats">
            <div className="patrimonio-stat">
              <span className="patrimonio-stat-label">Transazioni</span>
              <span className="patrimonio-stat-value">{s.count}</span>
              {deltaMeta(d && `${signOf(d.count)}${Math.abs(d.count)} ${vsPrev}`, spendTone(d?.count ?? null))}
            </div>
            <div className="patrimonio-stat">
              <span className="patrimonio-stat-label">Spesa totale</span>
              <span className="patrimonio-stat-value">{formatCurrency(s.total)}</span>
              {deltaMeta(d && `${signOf(d.total)}${formatCurrency(Math.abs(d.total))} ${vsPrev}`, spendTone(d?.total ?? null))}
            </div>
            <div className="patrimonio-stat">
              <span className="patrimonio-stat-label">Importo medio</span>
              <span className="patrimonio-stat-value">{s.avgAmount === null ? 'n.d.' : formatCurrency(s.avgAmount)}</span>
              <span className="patrimonio-stat-meta">per transazione</span>
            </div>
            <div className="patrimonio-stat">
              <span className="patrimonio-stat-label">Tra un acquisto e l'altro</span>
              <span className="patrimonio-stat-value">{s.avgGapDays === null ? 'n.d.' : `${s.avgGapDays.toLocaleString('it-IT', { maximumFractionDigits: 1 })} gg`}</span>
              <span className="patrimonio-stat-meta">{s.avgGapDays === null ? 'serve più di un acquisto' : 'giorni medi'}</span>
            </div>
            <div className="patrimonio-stat">
              <span className="patrimonio-stat-label">Ultimo acquisto</span>
              <span className="patrimonio-stat-value">{s.lastDate ? shortDay(s.lastDate) : 'n.d.'}</span>
              <span className="patrimonio-stat-meta">
                {daysAgo === null ? '' : daysAgo <= 0 ? 'oggi' : daysAgo === 1 ? 'ieri' : `${daysAgo} giorni fa`}
              </span>
            </div>
          </div>

          <div className="card">
            <div className="widget-head widget-head--wrap">
              <h3 className="widget-title">{category?.name ?? 'Categoria'}: quante volte e quanto</h3>
              <ul className="analysis-chart-legend">
                <li><span className="analysis-kind-dot" style={{ backgroundColor: countColor }} />Transazioni (asse sinistro)</li>
                <li><span className="analysis-legend-line" style={{ backgroundColor: spendColor }} />Spesa (asse destro)</li>
              </ul>
            </div>
            <p className="analysis-card-lead">
              {scope === 'period' ? 'Per settimana, ' : 'Per periodo, '}{scopeLabel}.
            </p>
            <div
              className="analysis-chart"
              role="img"
              aria-label={`${category?.name ?? 'Categoria'}: ${s.count} transazioni e ${formatCurrency(s.total)} spesi, ${scopeLabel}. I dati completi sono nella tabella sotto.`}
            >
              <ResponsiveContainer width="100%" height={260}>
                <ComposedChart data={view.rows} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: theme.axis }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                  <YAxis yAxisId="count" allowDecimals={false} tick={{ fontSize: 11, fill: theme.axis }} axisLine={false} tickLine={false} width={32} />
                  <YAxis yAxisId="spend" orientation="right" tick={{ fontSize: 11, fill: theme.axis }} axisLine={false} tickLine={false} width={48} tickFormatter={(v) => formatCurrencyAxis(Number(v))} />
                  <Tooltip content={<FocusTooltip formatCurrency={formatCurrency} />} cursor={{ fill: theme.isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' }} />
                  <Bar yAxisId="count" dataKey="count" fill={countColor} radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false} />
                  <Line yAxisId="spend" dataKey="total" type="linear" stroke={spendColor} strokeWidth={2} dot={{ r: 4, fill: spendColor, stroke: theme.surface, strokeWidth: 2 }} isAnimationActive={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <details className="analysis-focus-table">
              <summary>Dati in tabella</summary>
              <table>
                <thead>
                  <tr>
                    <th scope="col">{scope === 'period' ? 'Settimana' : 'Periodo'}</th>
                    <th scope="col">Transazioni</th>
                    <th scope="col">Spesa</th>
                  </tr>
                </thead>
                <tbody>
                  {view.rows.map((r) => (
                    <tr key={r.range}>
                      <th scope="row">{r.range}</th>
                      <td>{r.count}</td>
                      <td>{formatCurrency(r.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          </div>

          <div className="card">
            <div className="widget-head">
              <h3 className="widget-title">Descrizioni più frequenti</h3>
              <span className="widget-subtitle">per numero di acquisti</span>
            </div>
            {view.top.length === 0 ? (
              <p className="analysis-card-lead">Nessuna descrizione: aggiungila alle spese per riconoscere cosa compri più spesso.</p>
            ) : (
              <ul className="analysis-frequent">
                {view.top.map((f) => (
                  <li key={f.key} className="analysis-frequent-item">
                    <span className="analysis-frequent-body">
                      <span className="analysis-frequent-name">{f.label}</span>
                      <span className="analysis-frequent-meta">{f.count} {f.count === 1 ? 'volta' : 'volte'} · media {formatCurrency(f.avg)}</span>
                    </span>
                    <span className="analysis-frequent-total">{formatCurrency(f.total)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
