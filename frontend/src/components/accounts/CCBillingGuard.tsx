import { useCCBillingDue, useAccounts } from '../../hooks/useAccounts';
import AccountBillingModal from './AccountBillingModal';

export default function CCBillingGuard() {
  const { dueAccount, isOpen, dismiss } = useCCBillingDue();
  const { data: accounts = [] } = useAccounts();

  return (
    <AccountBillingModal
      isOpen={isOpen}
      account={dueAccount}
      allAccounts={accounts}
      onDismiss={dismiss}
    />
  );
}
