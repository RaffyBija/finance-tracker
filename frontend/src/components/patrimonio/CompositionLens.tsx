import { useMemo } from 'react';
import { useAccounts } from '../../hooks/useAccounts';
import { useFormatCurrency } from '../../hooks/useFormatCurrency';
import CompositionDonut from './CompositionDonut';

// Lente "Dove sono i soldi": composizione (donut) + metriche di concentrazione
// + dettaglio dell'esposizione carte conto per conto.

const isValidColor = (c?: string | null) => !!c && /^#[0-9A-Fa-f]{3,6}$/.test(c);

export default function CompositionLens() {
  const { data: accounts = [] } = useAccounts();
  const { formatCurrency } = useFormatCurrency();

  const metrics = useMemo(() => {
    // Solo conti BANK con liquidità positiva: i conti a saldo 0 o negativo non
    // contribuiscono alla composizione (coerente con il donut e con l'HHI).
    const bank = accounts.filter((a) => a.type !== 'CREDIT_CARD' && a.balance > 0);
    const total = bank.reduce((s, a) => s + a.balance, 0);
    const top = bank.reduce<{ name: string; balance: number } | null>(
      (m, a) => (!m || a.balance > m.balance ? { name: a.name, balance: a.balance } : m),
      null,
    );
    const topShare = top && total > 0 ? (top.balance / total) * 100 : 0;
    // Indice di concentrazione (Herfindahl, 0–100%): basso = ben distribuito.
    const hhi = total > 0 ? bank.reduce((s, a) => s + (a.balance / total) ** 2, 0) * 100 : 0;
    const spread = hhi >= 60 ? 'Concentrato' : hhi >= 35 ? 'Discreto' : 'Ben distribuito';
    return { count: bank.length, top, topShare, spread };
  }, [accounts]);

  const cards = useMemo(
    () => accounts.filter((a) => a.type === 'CREDIT_CARD' && a.balance < 0),
    [accounts],
  );

  return (
    <div className="lens-stack">
      <CompositionDonut />

      {metrics.count > 0 && (
        <div className="patrimonio-stats">
          <div className="patrimonio-stat">
            <span className="patrimonio-stat-label">Conti attivi</span>
            <span className="patrimonio-stat-value">{metrics.count}</span>
            <span className="patrimonio-stat-meta">con liquidità positiva</span>
          </div>
          <div className="patrimonio-stat">
            <span className="patrimonio-stat-label">Conto principale</span>
            <span className="patrimonio-stat-value">{Math.round(metrics.topShare)}%</span>
            <span className="patrimonio-stat-meta">{metrics.top?.name ?? '—'}</span>
          </div>
          <div className="patrimonio-stat">
            <span className="patrimonio-stat-label">Distribuzione</span>
            <span className="patrimonio-stat-value patrimonio-stat-value--sm">{metrics.spread}</span>
            <span className="patrimonio-stat-meta">tra i conti</span>
          </div>
        </div>
      )}

      {cards.length > 0 && (
        <div className="card">
          <div className="widget-head">
            <h3 className="widget-title">Esposizione carte</h3>
            <span className="widget-subtitle">Debito del ciclo aperto, per carta</span>
          </div>
          <ul className="cc-exposure-list">
            {cards.map((c) => (
              <li key={c.id} className="cc-exposure-item">
                <span className="cc-exposure-dot" style={{ background: isValidColor(c.color) ? c.color : '#a8a29e' }} />
                <span className="cc-exposure-name">{c.name}</span>
                <span className="cc-exposure-value">{formatCurrency(c.balance)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
