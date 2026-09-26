import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useSpendingAnalysis } from '../hooks/useAnalytics';
import AnalysisTabs, { ANALYSIS_TABS, type AnalysisTabId } from '../components/analysis/AnalysisTabs';
import PeriodPicker from '../components/analysis/PeriodPicker';
import SpendingOverview from '../components/analysis/SpendingOverview';
import CategoryAnalysis from '../components/analysis/CategoryAnalysis';
import SpendingHabits from '../components/analysis/SpendingHabits';
import NetWorthLens from '../components/analysis/NetWorthLens';
import { SkeletonCard } from '../components/shared/Skeleton';

// Sezione Analisi (route /patrimonio): strumenti per capire a fondo le spese
// (Spese, Categorie, Abitudini) e il patrimonio netto. Le prime tre schede
// condividono periodi (di paga o mesi), orizzonte e periodo selezionato.

type Mode = 'pay' | 'month';
const HORIZONS = [3, 6, 12] as const;

// Preferenze della vista (per viewer, non critiche): best effort su localStorage.
const PREF_KEY = 'analysisPrefs';
const readPrefs = (): { tab?: AnalysisTabId; mode?: Mode; horizon?: number } => {
  try { return JSON.parse(localStorage.getItem(PREF_KEY) ?? '{}'); } catch { return {}; }
};
const writePrefs = (p: object) => {
  try { localStorage.setItem(PREF_KEY, JSON.stringify(p)); } catch { /* storage non disponibile */ }
};

const isTab = (s: string): s is AnalysisTabId => ANALYSIS_TABS.some((t) => t.id === s);

const initialTab = (): AnalysisTabId => {
  const hash = window.location.hash.replace('#', '');
  if (isTab(hash)) return hash;
  const saved = readPrefs().tab;
  return saved && isTab(saved) ? saved : 'spese';
};

export default function PatrimonioPage() {
  const prefs = readPrefs();
  const [tab, setTab] = useState<AnalysisTabId>(initialTab);
  const [mode, setMode] = useState<Mode>(prefs.mode === 'month' ? 'month' : 'pay');
  const [horizon, setHorizon] = useState<number>(
    HORIZONS.some((h) => h === prefs.horizon) ? prefs.horizon! : 6,
  );
  const [selected, setSelected] = useState<number | null>(null);

  const { data, isLoading, isError } = useSpendingAnalysis(horizon, mode);

  useEffect(() => { writePrefs({ tab, mode, horizon }); }, [tab, mode, horizon]);

  // Cambiando orizzonte o modalità i periodi cambiano: si torna al periodo in corso.
  useEffect(() => { setSelected(null); }, [horizon, mode]);

  useEffect(() => {
    const onHash = () => {
      const hash = window.location.hash.replace('#', '');
      if (isTab(hash)) setTab(hash);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const selectTab = (id: AnalysisTabId) => {
    setTab(id);
    if (window.location.hash.replace('#', '') !== id) window.history.replaceState(null, '', `#${id}`);
  };

  const periodCount = data?.periods.length ?? 0;
  const sel = selected === null || selected >= periodCount ? periodCount - 1 : selected;
  const isSpendingTab = tab !== 'patrimonio';

  return (
    <div className="container-custom">
      <div className="page-header">
        <div>
          <Link to="/dashboard" className="outlook-detail-link projection-back">
            <ArrowLeft size={14} />
            Torna alla dashboard
          </Link>
          <h1 className="page-header-title">Analisi</h1>
          <p className="page-header-subtitle">Dove vanno i tuoi soldi, come spendi e quanto possiedi</p>
        </div>
      </div>

      <div className="patrimonio-sections">
        <AnalysisTabs active={tab} onChange={selectTab} />

        {isSpendingTab && (
          <div className="analysis-controls">
            <div className="projection-pills" role="group" aria-label="Suddivisione in periodi">
              <button type="button" className={`projection-pill${mode === 'pay' ? ' is-active' : ''}`} aria-pressed={mode === 'pay'} onClick={() => setMode('pay')}>
                Periodo di paga
              </button>
              <button type="button" className={`projection-pill${mode === 'month' ? ' is-active' : ''}`} aria-pressed={mode === 'month'} onClick={() => setMode('month')}>
                Mese
              </button>
            </div>
            <div className="projection-pills" role="group" aria-label="Numero di periodi">
              {HORIZONS.map((h) => (
                <button key={h} type="button" className={`projection-pill${horizon === h ? ' is-active' : ''}`} aria-pressed={horizon === h} onClick={() => setHorizon(h)}>
                  {h}
                </button>
              ))}
            </div>
            {data && (
              <PeriodPicker periods={data.periods} mode={data.mode} selected={sel} onChange={setSelected} />
            )}
          </div>
        )}

        {isSpendingTab && mode === 'pay' && data && !data.payPeriodConfigured && (
          <p className="analysis-hint">
            Periodo di paga non impostato: sto usando i mesi solari.{' '}
            <Link to="/profile#preferenze" className="projection-inline-link">Imposta lo stipendio</Link>
          </p>
        )}

        <div className="lens-panel" role="tabpanel" id={`lens-panel-${tab}`} aria-labelledby={`lens-tab-${tab}`}>
          {tab === 'patrimonio' ? (
            <NetWorthLens />
          ) : isLoading || (!data && !isError) ? (
            <SkeletonCard />
          ) : isError || !data ? (
            <div className="card dashboard-chart-empty">Impossibile caricare l'analisi. Riprova più tardi.</div>
          ) : (
            <>
              {tab === 'spese' && <SpendingOverview data={data} selected={sel} onSelect={setSelected} />}
              {tab === 'categorie' && <CategoryAnalysis data={data} selected={sel} />}
              {tab === 'abitudini' && <SpendingHabits data={data} selected={sel} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
