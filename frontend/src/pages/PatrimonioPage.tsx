import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, TrendingUp, TrendingDown, Minus, CreditCard } from 'lucide-react';
import { useNetWorthSeries } from '../hooks/useDashboard';
import { useAccounts } from '../hooks/useAccounts';
import { useFormatCurrency } from '../hooks/useFormatCurrency';
import PatrimonioLensTabs, { LENSES } from '../components/patrimonio/PatrimonioLensTabs';
import type { LensId } from '../components/patrimonio/PatrimonioLensTabs';
import TrendLens from '../components/patrimonio/TrendLens';
import CompositionLens from '../components/patrimonio/CompositionLens';
import SavingsLens from '../components/patrimonio/SavingsLens';
import SpendingLens from '../components/patrimonio/SpendingLens';
import { toneOf, signOf } from '../components/patrimonio/tone';

const STORAGE_KEY = 'patrimonioLens';
const isLensId = (s: string): s is LensId => LENSES.some((l) => l.id === s);

// Lente iniziale: priorità all'hash URL (link condivisibile), poi all'ultima scelta
// salvata, infine "andamento".
const initialLens = (): LensId => {
  const hash = window.location.hash.replace('#', '');
  if (hash && isLensId(hash)) return hash;
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved && isLensId(saved)) return saved;
  return 'andamento';
};

export default function PatrimonioPage() {
  const { formatCurrency, formatPercent } = useFormatCurrency();
  const [months, setMonths] = useState<number>(12);
  const [lens, setLens] = useState<LensId>(initialLens);

  const { data, isFetching } = useNetWorthSeries(months);
  const { data: accounts = [] } = useAccounts();

  // Persistenza lente + sync hash (back/forward del browser).
  const selectLens = (id: LensId) => {
    setLens(id);
    localStorage.setItem(STORAGE_KEY, id);
    if (window.location.hash.replace('#', '') !== id) {
      window.history.replaceState(null, '', `#${id}`);
    }
  };

  useEffect(() => {
    const onHash = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash && isLensId(hash)) setLens(hash);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // Esposizione CC (debito) — mostrata separata, mai sottratta dal patrimonio.
  const hasCreditCard = useMemo(() => accounts.some((a) => a.type === 'CREDIT_CARD'), [accounts]);
  const ccExposure = useMemo(
    () => accounts.filter((a) => a.type === 'CREDIT_CARD').reduce((s, a) => s + a.balance, 0),
    [accounts]
  );
  const ccIsDebt = ccExposure < 0;

  const current = data?.current ?? 0;
  const change = data?.change ?? 0;
  const changePct = data?.changePct ?? null;
  const changeTone = toneOf(change);

  return (
    <div className="container-custom">
      <div className="page-header">
        <div>
          <Link to="/dashboard" className="outlook-detail-link projection-back">
            <ArrowLeft size={14} />
            Torna alla dashboard
          </Link>
          <h1 className="page-header-title">Patrimonio</h1>
          <p className="page-header-subtitle">
            Quanto hai, dov'è e come è cambiato nel tempo
          </p>
        </div>
      </div>

      <div className="patrimonio-sections">
        {/* ── Hero patrimonio (ancora, sempre visibile) ── */}
        <div className="patrimonio-hero">
          <div className="patrimonio-hero-main">
            <span className="patrimonio-hero-label">Patrimonio liquido</span>
            <span className="patrimonio-hero-value">{formatCurrency(current)}</span>
            <span className={`patrimonio-hero-change is-${changeTone}`}>
              {changeTone === 'positive' ? <TrendingUp size={15} />
                : changeTone === 'negative' ? <TrendingDown size={15} />
                : <Minus size={15} />}
              {signOf(change)}{formatCurrency(Math.abs(change))}
              {changePct !== null && (
                <span className="patrimonio-hero-change-pct">
                  ({signOf(changePct)}{formatPercent(Math.abs(changePct), 2)}%)
                </span>
              )}
              <span className="patrimonio-hero-change-period">negli ultimi {months} mesi</span>
            </span>
          </div>
          {hasCreditCard && (
            <div className={`patrimonio-hero-cc${ccIsDebt ? ' is-debt' : ''}`}>
              <span className="patrimonio-hero-cc-icon"><CreditCard size={16} /></span>
              <div>
                <span className="patrimonio-hero-cc-label">Esposizione carte</span>
                <span className="patrimonio-hero-cc-value">{formatCurrency(ccExposure)}</span>
              </div>
            </div>
          )}
        </div>

        {/* ── Lenti di analisi ── */}
        <PatrimonioLensTabs active={lens} onChange={selectLens} />

        {/* ── Pannello della lente attiva (scorre) ── */}
        <div
          className="lens-panel"
          role="tabpanel"
          id={`lens-panel-${lens}`}
          aria-labelledby={`lens-tab-${lens}`}
        >
          {lens === 'andamento' && (
            <TrendLens months={months} setMonths={setMonths} data={data} isFetching={isFetching} />
          )}
          {lens === 'composizione' && <CompositionLens />}
          {lens === 'risparmio' && <SavingsLens months={months} />}
          {lens === 'spese' && <SpendingLens months={months} />}
        </div>
      </div>
    </div>
  );
}
