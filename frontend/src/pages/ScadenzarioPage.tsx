import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import PageHeader from '../components/shared/PageHeader';
import { usePending } from '../contexts/PendingContext';
import ScadenzarioTabs, {
  type ScadenzarioTabKey,
} from '../components/installments/ScadenzarioTabs';
import InstallmentPlansSection from '../components/installments/InstallmentPlansSection';
import { PlannedTransactions } from './PlannedPage';
import { RecurringTransactions } from './RecurringTransactions';

const HASHES: Record<string, ScadenzarioTabKey> = {
  '#piani': 'piani',
  '#pianificate': 'pianificate',
  '#ricorrenti': 'ricorrenti',
};

const tabFromHash = (hash: string): ScadenzarioTabKey => HASHES[hash] ?? 'piani';

export default function ScadenzarioPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { recurringDueCount, plannedDueCount, installmentDueCount } = usePending();

  const [tab, setTab] = useState<ScadenzarioTabKey>(tabFromHash(location.hash));

  // Sincronizza con l'hash (redirect da /planned e /recurring, deep-link).
  useEffect(() => {
    setTab(tabFromHash(location.hash));
  }, [location.hash]);

  const changeTab = (key: ScadenzarioTabKey) => {
    setTab(key);
    navigate(`/scadenzario#${key}`, { replace: true });
  };

  return (
    <div className="container-custom">
      <PageHeader
        title="Scadenzario"
        subtitle="Il registro dei tuoi movimenti futuri: piani a rate, pianificate e ricorrenti."
      />

      {/* Tutti i badge contano cose IN SCADENZA (rate/pianificate/occorrenze ≤ oggi) */}
      <ScadenzarioTabs
        active={tab}
        onChange={changeTab}
        tabs={[
          { key: 'piani', label: 'Piani a rate', count: installmentDueCount },
          { key: 'pianificate', label: 'Pianificate', count: plannedDueCount },
          { key: 'ricorrenti', label: 'Ricorrenti', count: recurringDueCount },
        ]}
      />

      {tab === 'piani' && <InstallmentPlansSection />}
      {tab === 'pianificate' && <PlannedTransactions embedded />}
      {tab === 'ricorrenti' && <RecurringTransactions embedded />}
    </div>
  );
}
