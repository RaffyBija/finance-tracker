import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import PageHeader from '../components/shared/PageHeader';
import { usePending } from '../contexts/PendingContext';
import { useInstallmentPlans } from '../hooks/useInstallmentPlans';
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
  const { recurringDueCount, plannedDueCount } = usePending();
  const { plans } = useInstallmentPlans();

  const [tab, setTab] = useState<ScadenzarioTabKey>(tabFromHash(location.hash));

  // Sincronizza con l'hash (redirect da /planned e /recurring, deep-link).
  useEffect(() => {
    setTab(tabFromHash(location.hash));
  }, [location.hash]);

  const changeTab = (key: ScadenzarioTabKey) => {
    setTab(key);
    navigate(`/scadenzario#${key}`, { replace: true });
  };

  const activePlans = plans.filter((p) => p.status === 'ACTIVE').length;

  return (
    <div className="container-custom">
      <PageHeader
        title="Scadenzario"
        subtitle="Il registro dei tuoi movimenti futuri: piani a rate, pianificate e ricorrenti."
      />

      <ScadenzarioTabs
        active={tab}
        onChange={changeTab}
        tabs={[
          { key: 'piani', label: 'Piani a rate', count: activePlans },
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
