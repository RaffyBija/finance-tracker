import { useState } from 'react';
import { Calendar } from 'lucide-react';
import ProjectedView from './ProjectedView';
import ForecastView from './ForecastView';

// Card unificata "Andamento del saldo".
// Due modalità mutuamente esclusive, così l'utente non vede mai due saldi futuri
// che competono affiancati:
//   • Impegni certi    → solo ricorrenti + pianificate + debito CC (orizzonte 1/3/6/12M o range)
//   • Stima realistica → impegni certi + spese abituali stimate (fine mese corrente)
// Entrambe partono dalla stessa liquidità reale (vedi getLiquidBalance lato backend).

type Mode = 'committed' | 'realistic';

export default function BalanceOutlookCard() {
  const [mode, setMode] = useState<Mode>('committed');

  return (
    <div className="projection-card" data-tour="dashboard-outlook">
      <div className="outlook-header">
        <h2 className="projection-title">
          <Calendar size={15} />
          Andamento del saldo
        </h2>

        <div className="outlook-mode-toggle" role="tablist" aria-label="Modalità di stima">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'committed'}
            className={`outlook-mode-btn${mode === 'committed' ? ' is-active' : ''}`}
            onClick={() => setMode('committed')}
          >
            Impegni certi
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'realistic'}
            className={`outlook-mode-btn${mode === 'realistic' ? ' is-active' : ''}`}
            onClick={() => setMode('realistic')}
          >
            Stima realistica
          </button>
        </div>
      </div>

      {mode === 'committed' ? <ProjectedView /> : <ForecastView />}
    </div>
  );
}
