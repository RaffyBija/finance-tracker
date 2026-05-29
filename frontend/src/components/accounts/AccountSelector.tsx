import type { Account } from '../../types';

interface AccountSelectorProps {
  accounts: Account[];
  value: string;
  onChange: (accountId: string) => void;
  label?: string;
  allowEmpty?: boolean;
  emptyLabel?: string;
}

export default function AccountSelector({
  accounts,
  value,
  onChange,
  label = 'Conto',
  allowEmpty = false,
  emptyLabel = '-- Nessun conto --',
}: AccountSelectorProps) {
  const selected = accounts.find((a) => a.id === value);

  return (
    <div className="account-selector-wrap form-group">
      {label && <label className="form-label">{label}</label>}
      <div className="account-selector-indicator">
        {selected && (
          <span
            className="account-selector-dot"
            style={{ backgroundColor: selected.color }}
          />
        )}
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="form-select"
          style={{ flex: 1 }}
        >
          {allowEmpty && <option value="">{emptyLabel}</option>}
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}{a.isDefault ? ' (principale)' : ''}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
