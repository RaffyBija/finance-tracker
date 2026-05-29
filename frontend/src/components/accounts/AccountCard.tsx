import { Pencil, Trash2, CreditCard, Landmark, Star } from 'lucide-react';
import type { Account } from '../../types';

interface AccountCardProps {
  account: Account;
  onEdit: (account: Account) => void;
  onDelete: (id: string) => void;
  onSetDefault: (id: string) => void;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(amount);
}

function daysUntilBilling(billingDay: number): number {
  const today = new Date();
  const day = today.getDate();
  if (billingDay === day) return 0;
  if (billingDay > day) return billingDay - day;
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  return daysInMonth - day + billingDay;
}

function BarFill({ pct }: { pct: number }) {
  const cls = pct >= 80 ? 'is-danger' : pct >= 50 ? 'is-warn' : 'is-ok';
  return (
    <div className="account-card-bar-track">
      <div
        className={`account-card-bar-fill ${cls}`}
        style={{ width: `${Math.min(pct, 100)}%` }}
      />
    </div>
  );
}

export default function AccountCard({ account, onEdit, onDelete, onSetDefault }: AccountCardProps) {
  const isCC = account.type === 'CREDIT_CARD';
  const balance = account.balance;
  const debt = isCC ? Math.abs(balance) : null;

  const balanceCls =
    isCC || balance < 0 ? 'is-negative' : balance === 0 ? 'is-zero' : 'is-positive';

  const pct = isCC && account.creditLimit
    ? (debt! / account.creditLimit) * 100
    : 0;

  const billing = isCC && account.billingDay ? daysUntilBilling(account.billingDay) : null;

  return (
    <div className="account-card">
      {/* Top row */}
      <div className="account-card-top">
        <div className="account-card-identity">
          <span
            className="account-card-dot"
            style={{ backgroundColor: account.color }}
          />
          <div className="account-card-name-group">
            <span className="account-card-name">{account.name}</span>
            <span className={isCC ? 'badge badge-info' : 'badge badge-neutral'}>
              {isCC ? 'Carta di credito' : 'Conto'}
            </span>
          </div>
        </div>
        <div className="account-card-actions">
          {!account.isDefault && (
            <button
              onClick={() => onSetDefault(account.id)}
              className="btn-icon-primary"
              title="Imposta come principale"
            >
              <Star className="icon-sm" />
            </button>
          )}
          <button onClick={() => onEdit(account)} className="btn-icon-primary">
            <Pencil className="icon-sm" />
          </button>
          {!account.isDefault && (
            <button onClick={() => onDelete(account.id)} className="btn-icon-danger">
              <Trash2 className="icon-sm" />
            </button>
          )}
        </div>
      </div>

      {/* Balance */}
      <div className="account-card-balance">
        <span className="account-card-balance-label">
          {isCC ? 'Debito attuale' : 'Saldo'}
        </span>
        <span className={`account-card-balance-amount ${balanceCls}`}>
          {isCC ? formatCurrency(debt!) : formatCurrency(balance)}
        </span>
      </div>

      {/* CC usage bar */}
      {isCC && account.creditLimit && (
        <div className="account-card-bar-section">
          <div className="account-card-bar-meta">
            <span>Utilizzo: {Math.round(pct)}%</span>
            <span>Limite: {formatCurrency(account.creditLimit)}</span>
          </div>
          <BarFill pct={pct} />
        </div>
      )}

      {/* Footer */}
      <div className="account-card-footer">
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          {isCC ? <CreditCard size={12} /> : <Landmark size={12} />}
          {account.isDefault ? 'Conto principale' : `${account._count?.transactions ?? 0} transazioni`}
        </span>
        {billing !== null && (
          <span className={`account-card-billing${billing === 0 ? ' account-card-billing-today' : ''}`}>
            {billing === 0
              ? 'Addebito oggi'
              : `Addebito tra ${billing} ${billing === 1 ? 'giorno' : 'giorni'}`}
          </span>
        )}
      </div>
    </div>
  );
}
