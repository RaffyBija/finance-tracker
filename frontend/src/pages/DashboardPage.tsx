// frontend/src/pages/DashboardPage.tsx

import { useState, useMemo } from 'react';
import { SlidersHorizontal, LayoutGrid } from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { useSummary } from '../hooks/useDashboard';
import { useAccounts } from '../hooks/useAccounts';
import { useFormatCurrency } from '../hooks/useFormatCurrency';
import { useDashboardLayout } from '../hooks/useDashboardLayout';
import { WIDGET_MAP } from '../components/dashboard/widgets/registry';
import CustomizeDashboardModal from '../components/dashboard/CustomizeDashboardModal';

export default function DashboardPage() {
  const { formatCurrency } = useFormatCurrency();
  const [showCustomize, setShowCustomize] = useState(false);
  const { items, toggle, move, reset } = useDashboardLayout();

  // L'Hero è sempre ancorato al mese corrente (niente navigazione: ciò che è
  // navigabile è solo l'analisi storica, dentro i singoli widget analitici).
  const monthRange = useMemo(() => {
    const now = new Date();
    return {
      startDate: format(startOfMonth(now), 'yyyy-MM-dd'),
      endDate: format(endOfMonth(now), 'yyyy-MM-dd'),
    };
  }, []);

  const { data: summary,      isLoading: summaryLoading }      = useSummary(monthRange);
  const { data: totalSummary, isLoading: totalSummaryLoading } = useSummary();
  const { data: accounts = [], isLoading: accountsLoading }     = useAccounts();

  const liquidAccounts = accounts.filter((a) => a.type !== 'CREDIT_CARD');
  const multiAccount = liquidAccounts.length > 1;
  const netWorth = liquidAccounts.reduce((s, a) => s + a.balance, 0);

  const hasAccounts = liquidAccounts.length > 0;
  const heroValue = hasAccounts ? netWorth : (totalSummary?.balance ?? 0);
  const heroLoading = accountsLoading || (!hasAccounts && totalSummaryLoading);
  const heroPositive = heroValue >= 0;

  // ── Raggruppamento widget per zona ──
  const enabled = items.filter((i) => i.enabled && WIDGET_MAP[i.id]);
  const barItems = enabled.filter((i) => WIDGET_MAP[i.id].slot === 'bar');
  const tileItems = enabled.filter((i) => WIDGET_MAP[i.id].slot === 'tile');
  const contentItems = enabled.filter((i) => WIDGET_MAP[i.id].slot === 'content');
  const nothingEnabled = enabled.length === 0;

  return (
    <div className="container-custom">

      {/* ── Toolbar ── */}
      <div className="dashboard-toolbar">
        <button
          type="button"
          className="btn btn-ghost btn-sm dashboard-customize-btn"
          onClick={() => setShowCustomize(true)}
        >
          <SlidersHorizontal size={15} />
          Personalizza
        </button>
      </div>

      {/* ── Hero (fisso, mese corrente) ── */}
      <div className="dashboard-hero mb-6" data-tour="dashboard-hero">
        <div className="dashboard-hero-top">
          <div>
            <p className="dashboard-hero-label">
              {multiAccount ? 'Liquidità totale' : 'Liquidità disponibile'}
            </p>
            {heroLoading ? (
              <div className="dashboard-hero-value-skeleton animate-pulse" />
            ) : (
              <p className={`dashboard-hero-value${!heroPositive ? ' is-negative' : ''}`}>
                {heroPositive ? '+' : '−'}{formatCurrency(Math.abs(heroValue))}
              </p>
            )}
          </div>
        </div>

        {/* Breakdown per conto (solo multi-account) */}
        {multiAccount && (
          <div className="dashboard-hero-accounts">
            {liquidAccounts.map((a) => (
              <div key={a.id} className="dashboard-hero-account-row">
                <span className="dashboard-hero-account-name">
                  <span
                    className="dashboard-hero-account-dot"
                    style={{ backgroundColor: a.color }}
                  />
                  {a.name}
                </span>
                <span className={`dashboard-hero-account-amount${a.balance < 0 ? ' is-negative' : ''}`}>
                  {a.balance >= 0 ? '+' : '−'}{formatCurrency(Math.abs(a.balance))}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="dashboard-hero-stats dashboard-stats-reveal">
          {summaryLoading ? (
            [0, 1, 2, 3].map((i) => (
              <div key={i} className="dashboard-hero-stat animate-pulse">
                <div style={{ height: '0.625rem', width: '3rem', background: 'rgba(255,255,255,0.2)', borderRadius: '0.25rem', marginBottom: '0.375rem' }} />
                <div style={{ height: '1.125rem', width: '5rem', background: 'rgba(255,255,255,0.25)', borderRadius: '0.25rem' }} />
              </div>
            ))
          ) : (
            <>
              <div className="dashboard-hero-stat">
                <p className="dashboard-hero-stat-label">Entrate</p>
                <p className="dashboard-hero-stat-value dashboard-hero-stat-income">+{formatCurrency(summary?.income ?? 0)}</p>
              </div>
              <div className="dashboard-hero-stat">
                <p className="dashboard-hero-stat-label">Uscite</p>
                <p className="dashboard-hero-stat-value dashboard-hero-stat-expense">−{formatCurrency(summary?.expense ?? 0)}</p>
              </div>
              <div className="dashboard-hero-stat">
                <p className="dashboard-hero-stat-label">Netto del mese</p>
                <p className={`dashboard-hero-stat-value${summary && summary.balance >= 0 ? ' dashboard-hero-stat-income' : ' dashboard-hero-stat-expense'}`}>
                  {summary && summary.balance >= 0 ? '+' : '−'}{formatCurrency(Math.abs(summary?.balance ?? 0))}
                </p>
              </div>
              <div className="dashboard-hero-stat">
                <p className="dashboard-hero-stat-label">Transazioni</p>
                <p className="dashboard-hero-stat-value">{summary?.transactionCount}</p>
              </div>
            </>
          )}
        </div>

        {!summaryLoading && (
          <p className="dashboard-hero-stats-caption">
            Movimenti del mese corrente · tutti i conti (CC inclusa)
          </p>
        )}
      </div>

      {/* ── Barra azioni rapide ── */}
      {barItems.map((item) => {
        const Widget = WIDGET_MAP[item.id].component;
        return <Widget key={item.id} />;
      })}

      {/* ── Fascia tessere KPI ── */}
      {tileItems.length > 0 && (
        <div className="dashboard-tiles-row">
          {tileItems.map((item) => {
            const Widget = WIDGET_MAP[item.id].component;
            return <Widget key={item.id} />;
          })}
        </div>
      )}

      {/* ── Griglia contenuti ── */}
      {contentItems.length > 0 && (
        <div className="dashboard-widget-grid">
          {contentItems.map((item) => {
            const def = WIDGET_MAP[item.id];
            const Widget = def.component;
            return (
              <div key={item.id} className={`dashboard-widget is-${def.size}`}>
                <Widget />
              </div>
            );
          })}
        </div>
      )}

      {/* ── Empty state (nessun widget attivo) ── */}
      {nothingEnabled && (
        <div className="dashboard-empty-grid">
          <LayoutGrid size={28} className="dashboard-empty-grid-icon" />
          <p className="dashboard-empty-grid-title">Nessun widget attivo</p>
          <p className="dashboard-empty-grid-text">
            La dashboard è vuota. Aggiungi i riquadri che ti servono.
          </p>
          <button type="button" className="btn btn-primary btn-md" onClick={() => setShowCustomize(true)}>
            <SlidersHorizontal size={15} />
            Aggiungi widget
          </button>
        </div>
      )}

      <CustomizeDashboardModal
        isOpen={showCustomize}
        onClose={() => setShowCustomize(false)}
        items={items}
        toggle={toggle}
        move={move}
        reset={reset}
      />
    </div>
  );
}
