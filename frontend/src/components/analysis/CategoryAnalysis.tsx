import { useMemo, useState } from 'react';
import { ChevronDown, AlertTriangle } from 'lucide-react';
import type { ExpenseKind, SpendingAnalysis } from '../../types';
import { useFormatCurrency } from '../../hooks/useFormatCurrency';
import { KINDS, UNCATEGORIZED, categoryRows, frequentDescriptions, isNotable, linesIn, type CategoryRow } from './model';
import { spendTone, pct, dayLabel } from './ui';
import { signOf } from '../patrimonio/tone';

// Scheda "Categorie": dove va il denaro nel periodo, rispetto al solito.
//   • filtro per natura (es. solo variabili: le fisse non si "decidono");
//   • ordinamento per importo o per scostamento dalla media;
//   • scostamenti notevoli evidenziati (±25% e almeno 15 €);
//   • ogni riga si apre sul dettaglio: movimenti del periodo, voci più frequenti,
//     scontrino medio e andamento nei periodi.

interface Props {
  data: SpendingAnalysis;
  selected: number;
}

type KindFilter = 'all' | ExpenseKind;
type SortBy = 'total' | 'delta';

const isValidColor = (c?: string | null) => !!c && /^#[0-9A-Fa-f]{3,8}$/.test(c);

function Sparkline({ series, selected }: { series: number[]; selected: number }) {
  const max = Math.max(...series, 1);
  const w = 6;
  const gap = 3;
  const h = 24;
  return (
    <svg
      className="analysis-spark"
      width={series.length * (w + gap) - gap}
      height={h}
      viewBox={`0 0 ${series.length * (w + gap) - gap} ${h}`}
      aria-hidden
    >
      {series.map((v, i) => {
        const bh = Math.max(v > 0 ? 2 : 1, (v / max) * h);
        return (
          <rect
            key={i}
            x={i * (w + gap)}
            y={h - bh}
            width={w}
            height={bh}
            rx={2}
            className={i === selected ? 'analysis-spark-bar is-selected' : 'analysis-spark-bar'}
          />
        );
      })}
    </svg>
  );
}

export default function CategoryAnalysis({ data, selected }: Props) {
  const { formatCurrency } = useFormatCurrency();
  const [kind, setKind] = useState<KindFilter>('all');
  const [sortBy, setSortBy] = useState<SortBy>('total');
  const [open, setOpen] = useState<string | null>(null);

  const filtered = useMemo(
    () => (kind === 'all' ? data : { ...data, lines: data.lines.filter((l) => l.kind === kind) }),
    [data, kind],
  );
  const rows = useMemo(() => {
    const r = categoryRows(filtered, selected);
    return sortBy === 'delta'
      ? [...r].sort((a, b) => Math.abs(b.delta ?? 0) - Math.abs(a.delta ?? 0))
      : r;
  }, [filtered, selected, sortBy]);
  const period = data.periods[selected];
  const notable = rows.filter(isNotable);

  const lineMatches = (row: CategoryRow) => (l: { categoryId: string | null }) =>
    (l.categoryId ?? UNCATEGORIZED) === row.id;

  return (
    <div className="lens-stack">
      <div className="analysis-toolbar">
        <div className="projection-pills" role="group" aria-label="Natura della spesa">
          <button type="button" className={`projection-pill${kind === 'all' ? ' is-active' : ''}`} aria-pressed={kind === 'all'} onClick={() => setKind('all')}>Tutte</button>
          {KINDS.map((k) => (
            <button key={k.id} type="button" className={`projection-pill${kind === k.id ? ' is-active' : ''}`} aria-pressed={kind === k.id} onClick={() => setKind(k.id)}>
              {k.label}
            </button>
          ))}
        </div>
        <div className="projection-pills" role="group" aria-label="Ordina">
          <button type="button" className={`projection-pill${sortBy === 'total' ? ' is-active' : ''}`} aria-pressed={sortBy === 'total'} onClick={() => setSortBy('total')}>Per importo</button>
          <button type="button" className={`projection-pill${sortBy === 'delta' ? ' is-active' : ''}`} aria-pressed={sortBy === 'delta'} onClick={() => setSortBy('delta')}>Per scostamento</button>
        </div>
      </div>

      {notable.length > 0 && (
        <div className="analysis-notice">
          <AlertTriangle size={15} aria-hidden />
          <span>
            {notable.length === 1 ? 'Una categoria si discosta' : `${notable.length} categorie si discostano`} dalla media
            {period.isCurrent ? ' alla stessa data' : ''}:{' '}
            {notable.slice(0, 3).map((r) => (r.deltaPct === null
              ? `${r.name} (nuova, ${formatCurrency(r.total)})`
              : `${r.name} ${signOf(r.delta!)}${pct(Math.abs(r.deltaPct))}`)).join(', ')}
            {notable.length > 3 ? '…' : ''}
          </span>
        </div>
      )}

      <div className="card analysis-table-card">
        {rows.length === 0 ? (
          <div className="dashboard-chart-empty">Nessuna spesa nel periodo</div>
        ) : (
          <>
            <div className="analysis-table-head" aria-hidden>
              <span>Categoria</span>
              <span className="analysis-col-trend">Andamento</span>
              <span className="analysis-col-num">Periodo</span>
              <span className="analysis-col-num analysis-col-delta">vs media</span>
            </div>
            <ul className="analysis-table">
              {rows.map((r) => {
                const isOpen = open === r.id;
                const tone = spendTone(r.delta);
                const catLines = linesIn(filtered.lines, period).filter(lineMatches(r))
                  .sort((a, b) => b.date.localeCompare(a.date) || b.amount - a.amount);
                const spanLines = filtered.lines.filter(lineMatches(r));
                const frequent = isOpen ? frequentDescriptions(spanLines).slice(0, 5) : [];
                const biggest = catLines.reduce((m, l) => (l.amount > m ? l.amount : m), 0);
                return (
                  <li key={r.id} className={`analysis-row${isOpen ? ' is-open' : ''}${isNotable(r) ? ' is-notable' : ''}`}>
                    <button
                      type="button"
                      className="analysis-row-main"
                      aria-expanded={isOpen}
                      onClick={() => setOpen(isOpen ? null : r.id)}
                    >
                      <span className="analysis-row-name">
                        <span className="analysis-cat-dot" style={{ backgroundColor: isValidColor(r.color) ? r.color! : '#a8a29e' }} />
                        <span className="analysis-row-label">{r.name}</span>
                        <span className="analysis-row-share">{pct(r.share)}</span>
                      </span>
                      <span className="analysis-col-trend"><Sparkline series={r.series} selected={selected} /></span>
                      <span className="analysis-col-num analysis-row-total">{formatCurrency(r.total)}</span>
                      <span className={`analysis-col-num analysis-col-delta is-${tone}`}>
                        {r.delta === null ? 'n.d.' : `${signOf(r.delta)}${formatCurrency(Math.abs(r.delta))}`}
                      </span>
                      <ChevronDown size={16} className="analysis-row-chevron" aria-hidden />
                    </button>

                    {isOpen && (
                      <div className="analysis-drill">
                        <div className="analysis-drill-stats">
                          <span><strong>{r.count}</strong> {r.count === 1 ? 'movimento' : 'movimenti'}</span>
                          <span>scontrino medio <strong>{formatCurrency(r.avgTicket)}</strong></span>
                          {biggest > 0 && <span>più alto <strong>{formatCurrency(biggest)}</strong></span>}
                          {r.avg !== null && <span>media {period.isCurrent ? 'alla stessa data' : 'per periodo'} <strong>{formatCurrency(r.avg)}</strong></span>}
                        </div>

                        {catLines.length > 0 ? (
                          <ul className="analysis-drill-list">
                            {catLines.slice(0, 12).map((l, i) => (
                              <li key={`${l.txId}-${i}`} className="analysis-drill-item">
                                <span className="analysis-drill-date">{dayLabel(l.date)}</span>
                                <span className="analysis-drill-desc">{l.description || 'Senza descrizione'}</span>
                                <span className="analysis-drill-kind">{KINDS.find((k) => k.id === l.kind)?.label}</span>
                                <span className="analysis-drill-amount">{formatCurrency(l.amount)}</span>
                              </li>
                            ))}
                            {catLines.length > 12 && (
                              <li className="analysis-drill-more">e altri {catLines.length - 12} movimenti</li>
                            )}
                          </ul>
                        ) : (
                          <p className="analysis-drill-empty">Nessun movimento in questo periodo.</p>
                        )}

                        {frequent.length > 0 && (
                          <div className="analysis-drill-frequent">
                            <span className="analysis-subtitle">Voci più ricorrenti (tutti i periodi)</span>
                            <ul>
                              {frequent.map((f) => (
                                <li key={f.key}>
                                  <span className="analysis-drill-desc">{f.label}</span>
                                  <span className="analysis-drill-kind">{f.count} volte · media {formatCurrency(f.avg)}</span>
                                  <span className="analysis-drill-amount">{formatCurrency(f.total)}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
