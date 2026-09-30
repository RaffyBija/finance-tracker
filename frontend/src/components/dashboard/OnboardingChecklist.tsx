import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Circle, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useAccounts } from '../../hooks/useAccounts';
import { useSummary } from '../../hooks/useDashboard';
import { useForecast } from '../../hooks/useAnalytics';
import { useCategories } from '../../hooks/useCategories';
import AccountFormModal from '../accounts/AccountFormModal';
import TransactionModal from '../transactions/TransactionModal';

const dismissKey = (userId?: string) => `onboardingDismissed:${userId ?? ''}`;

const readDismissed = (userId?: string) => {
  try { return localStorage.getItem(dismissKey(userId)) === '1'; } catch { return false; }
};

/**
 * Checklist di setup: si calcola dai dati reali, mostra solo ciò che manca e
 * sparisce da sola a setup completo. Ogni passo apre il flusso già esistente.
 */
export default function OnboardingChecklist() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: accounts, isLoading: accountsLoading } = useAccounts();
  const { data: total, isLoading: totalLoading } = useSummary();
  const { data: forecast, isLoading: forecastLoading, isError: forecastError } = useForecast();
  const { data: categories = [] } = useCategories();
  const [dismissed, setDismissed] = useState(() => readDismissed(user?.id));
  const [showAccount, setShowAccount] = useState(false);
  const [showTx, setShowTx] = useState(false);

  if (dismissed || accountsLoading || totalLoading || forecastLoading || !accounts || !total) return null;

  const steps = [
    {
      id: 'account',
      label: 'Aggiungi il tuo conto',
      hint: 'Il conto corrente da cui parte il saldo.',
      done: accounts.some((a) => a.type !== 'CREDIT_CARD'),
      action: () => setShowAccount(true),
    },
    {
      id: 'salary',
      label: 'Imposta lo stipendio',
      hint: 'Categoria e giorno di paga: servono a Proiezione e Budget.',
      // Stessa definizione della Proiezione: payDay oppure stipendio pianificato/ricorrente.
      // Errore di rete: non mostrare un passo che non sappiamo se sia mancante.
      done: forecastError || !!forecast?.payPeriod.configured,
      action: () => navigate('/profile#preferenze'),
    },
    {
      id: 'transaction',
      label: 'Registra la prima transazione',
      hint: 'Entrata o uscita, in pochi secondi.',
      done: total.transactionCount > 0,
      action: () => setShowTx(true),
    },
  ];
  const missing = steps.filter((s) => !s.done);
  if (missing.length === 0) return null;

  const dismiss = () => {
    try { localStorage.setItem(dismissKey(user?.id), '1'); } catch { /* preferenza non salvata */ }
    setDismissed(true);
  };

  return (
    <section className="card card-md onboarding-card" aria-label="Configurazione iniziale">
      <div className="onboarding-head">
        <div>
          <h2 className="onboarding-title">Completa la configurazione</h2>
          <p className="onboarding-progress">{steps.length - missing.length} di {steps.length} passi</p>
        </div>
        <button type="button" className="btn btn-icon" onClick={dismiss} aria-label="Nascondi la configurazione">
          <X size={16} />
        </button>
      </div>
      <ul className="onboarding-list">
        {steps.map((s) => (
          <li key={s.id} className={`onboarding-step${s.done ? ' is-done' : ''}`}>
            <span className="onboarding-step-icon" aria-hidden="true">
              {s.done ? <Check size={14} /> : <Circle size={14} />}
            </span>
            <span className="onboarding-step-text">
              <span className="onboarding-step-label">{s.label}</span>
              {!s.done && <span className="onboarding-step-hint">{s.hint}</span>}
            </span>
            {!s.done && (
              <button type="button" className="btn btn-primary btn-sm" onClick={s.action}>
                Inizia
              </button>
            )}
          </li>
        ))}
      </ul>

      <AccountFormModal isOpen={showAccount} onClose={() => setShowAccount(false)} />
      <TransactionModal
        isOpen={showTx}
        categories={categories}
        editingTransactionData={null}
        onClose={() => setShowTx(false)}
        sentFeed={() => {}}
      />
    </section>
  );
}
