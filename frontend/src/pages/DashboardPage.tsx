// frontend/src/pages/DashboardPage.tsx

import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, SlidersHorizontal } from 'lucide-react';
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns';
import { formatMonthYear } from '../utils/date';
import { useSummary } from '../hooks/useDashboard';
import { useAccounts } from '../hooks/useAccounts';
import { useFormatCurrency } from '../hooks/useFormatCurrency';
import { useDashboardLayout } from '../hooks/useDashboardLayout';
import { WIDGET_MAP } from '../components/dashboard/widgets/registry';
import { DashboardMonthProvider } from '../contexts/DashboardMonthContext';
import CustomizeDashboardModal from '../components/dashboard/CustomizeDashboardModal';

export default function DashboardPage() {
  const { formatCurrency } = useFormatCurrency();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showCustomize, setShowCustomize] = useState(false);

  const { items, toggle, move, reset } = useDashboardLayout();

  const monthRange = useMemo(() => ({
    startDate: format(startOfMonth(currentMonth), 'yyyy-MM-dd'),
    endDate: format(endOfMonth(currentMonth), 'yyyy-MM-dd'),
  }), [currentMonth]);

  const isCurrentMonth = useMemo(() => {
    const now = new Date();
    return (
      currentMonth.getMonth() === now.getMonth() &&
      currentMonth.getFullYear() === now.getFullYear()
    );
  }, [currentMonth]);

  // ── Query per l'Hero (le altre vivono nei singoli widget) ──
  const { data: summary,      isLoading: summaryLoading }      = useSummary(monthRange);
  const { data: totalSummary, isLoading: totalSummaryLoading } = useSummary();
  const { data: accounts = [], isLoading: accountsLoading }     = useAccounts();

  const liquidAccounts = accounts.filter((a) => a.type !== 'CREDIT_CARD');
  const multiAccount = liquidAccounts.length > 1;
  const netWorth = liquidAccounts.reduce((s, a) => s + a.balance, 0);

  // Finché i conti non sono caricati non sappiamo se mostrare netWorth (liquidità
  // BANK) o il saldo all-time: mostrare quest'ultimo a metà caricamento causa un
  // flicker (include le CC). Aspettiamo i conti prima di decidere.
  const hasAccounts = liquidAccounts.length > 0;
  const heroValue = hasAccounts ? netWorth : (totalSummary?.balance ?? 0);
  const heroLoading = accountsLoading || (!hasAccounts && totalSummaryLoading);
  const heroPositive = heroValue >= 0;

  const monthContext = useMemo(
    () => ({ currentMonth, monthRange, isCurrentMonth }),
    [currentMonth, monthRange, isCurrentMonth]
  );

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

      {/* ── Hero (fisso) ── */}
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
          <div className="dashboard-hero-nav">
            <button onClick={() => setCurrentMonth((d) => subMonths(d, 1))} className="dashboard-nav-btn">
              <ChevronLeft size={15} />
            </button>
            <span className="dashboard-month-pill">
              {formatMonthYear(currentMonth)}
            </span>
            <button onClick={() => setCurrentMonth((d) => addMonths(d, 1))} disabled={isCurrentMonth} className="dashboard-nav-btn">
              <ChevronRight size={15} />
            </button>
            {!isCurrentMonth && (
              <button onClick={() => setCurrentMonth(new Date())} className="dashboard-today-btn">
                Oggi
              </button>
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

        <div key={format(currentMonth, 'yyyy-MM')} className="dashboard-hero-stats dashboard-stats-reveal">
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
            Movimenti del mese · tutti i conti (CC inclusa)
          </p>
        )}
      </div>

      {/* ── Griglia widget personalizzabile ── */}
      <DashboardMonthProvider value={monthContext}>
        <div className="dashboard-widget-grid">
          {items
            .filter((item) => item.enabled && WIDGET_MAP[item.id])
            .map((item) => {
              const def = WIDGET_MAP[item.id];
              const Widget = def.component;
              return (
                <div key={item.id} className={`dashboard-widget is-${def.size}`}>
                  <Widget />
                </div>
              );
            })}
        </div>
      </DashboardMonthProvider>

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
