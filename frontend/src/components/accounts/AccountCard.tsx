import { Pencil, Trash2, CreditCard, Landmark, Star } from 'lucide-react';
import { useFormatCurrency } from '../../hooks/useFormatCurrency';
import { daysUntilBilling } from '../../utils/billing';
import type { Account } from '../../types';

interface AccountCardProps {
  account: Account;
  onEdit: (account: Account) => void;
  onDelete: (id: string) => void;
  onSetDefault: (id: string) => void;
  onOpen?: (account: Account) => void;
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

export default function AccountCard({ account, onEdit, onDelete, onSetDefault, onOpen }: AccountCardProps) {
  const { formatCurrency } = useFormatCurrency();
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
    <div
      className={`account-card${onOpen ? ' is-clickable' : ''}`}
      onClick={onOpen ? () => onOpen(account) : undefined}
      role={onOpen ? 'button' : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onKeyDown={onOpen ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(account); } } : undefined}
    >
      {/* Top row */}
      <div className="account-card-top">
        <div className="account-card-identity">
          <span
            className="account-card-dot"
            style={{ backgroundColor: account.color }}
          />
          <div className="account-card-name-group">
            <span className="account-card-name">{account.name}</span>
            <span className="account-card-badges">
              <span className={isCC ? 'badge badge-info' : 'badge badge-neutral'}>
                {isCC ? 'Carta di credito' : 'Conto'}
              </span>
              {!isCC && (account.linkedCC?.length ?? 0) > 0 && (
                <span
                  className="account-card-cc-chip"
                  title={`${account.linkedCC!.length} carta/e collegata/e`}
                >
                  <CreditCard className="icon-xs" />
                  {account.linkedCC!.length}
                </span>
              )}
            </span>
          </div>
        </div>
        <div className="account-card-actions" onClick={(e) => e.stopPropagation()}>
          {!account.isDefault && (
            <button
              onClick={() => onSetDefault(account.id)}
              className="btn-icon-primary"
              title="Imposta come principale"
              aria-label="Imposta come principale"
            >
              <Star className="icon-sm" />
            </button>
          )}
          <button onClick={() => onEdit(account)} className="btn-icon-primary" title="Modifica conto" aria-label="Modifica conto">
            <Pencil className="icon-sm" />
          </button>
          {!account.isDefault && (
            <button onClick={() => onDelete(account.id)} className="btn-icon-danger" title="Elimina conto" aria-label="Elimina conto">
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
        <span className="account-card-footer-meta">
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
