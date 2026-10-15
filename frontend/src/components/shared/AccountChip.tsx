import type { Account } from '../../types';

interface AccountChipProps {
  account?: Pick<Account, 'name' | 'color'> | null;
}

/** Pallino colorato + nome del conto, inline nelle righe meta. Niente conto → niente chip. */
export default function AccountChip({ account }: AccountChipProps) {
  if (!account) return null;
  return (
    <span className="account-chip" title={`Conto: ${account.name}`}>
      <span className="account-chip-dot" style={{ backgroundColor: account.color }} />
      <span className="account-chip-name">{account.name}</span>
    </span>
  );
}
