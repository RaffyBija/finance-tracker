import { useState } from 'react';
import { CreditCard, Landmark, ArrowRight } from 'lucide-react';
import BaseModal from '../layout/ModalBase';
import { useSettleAccount, useBillingCycles } from '../../hooks/useAccounts';
import { useCategories } from '../../hooks/useCategories';
import { useToast } from '../../contexts/ToastContext';
import { useFormatCurrency } from '../../hooks/useFormatCurrency';
import type { Account } from '../../types';

interface AccountBillingModalProps {
  isOpen: boolean;
  account: Account | null;
  allAccounts: Account[];
  onDismiss: () => void;
}

export default function AccountBillingModal({
  isOpen,
  account,
  allAccounts,
  onDismiss,
}: AccountBillingModalProps) {
  const settleMutation = useSettleAccount();
  const toast = useToast();
  const { data: categories = [] } = useCategories('EXPENSE');
  const { data: cycles = [] } = useBillingCycles(account?.id ?? null, isOpen);
  const [categoryId, setCategoryId] = useState('');
  const { formatCurrency } = useFormatCurrency();

  if (!isOpen || !account) return null;

  // L'addebito dovuto = somma delle pianificate dei cicli CHIUSI non ancora pagate
  // e scadute (data di addebito ≤ oggi). Non è il debito del ciclo aperto.
  const endOfToday = new Date(); endOfToday.setHours(23, 59, 59, 999);
  const debt = cycles.reduce((sum, c) => {
    if (c.status === 'CLOSED' && c.planned && !c.planned.isPaid && new Date(c.planned.plannedDate) <= endOfToday) {
      return sum + c.planned.amount;
    }
    return sum;
  }, 0);
  const linkedAccount = allAccounts.find((a) => a.id === account.linkedAccountId) ?? null;
  const today = new Date().toLocaleDateString('it-IT', { day: 'numeric', month: 'long' });

  const handleSettle = async () => {
    try {
      const result = await settleMutation.mutateAsync({ id: account.id, categoryId: categoryId || undefined });
      toast.success(`Addebito di ${formatCurrency(result.settledAmount)} registrato`);
      onDismiss();
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Errore nel registrare l\'addebito');
    }
  };

  return (
    <BaseModal isOpen={isOpen} title="Addebito carta di credito" onClose={onDismiss}>
      <div className="modal-form">
        <p className="recurring-due-subtitle" style={{ fontSize: '0.9375rem' }}>
          Oggi è il giorno di addebito della tua carta. Vuoi registrare il pagamento?
        </p>

        {/* Riepilogo addebito */}
        <div style={{
          background: 'oklch(0.97 0.01 90)',
          border: '1px solid oklch(0.92 0.04 90)',
          borderRadius: '0.625rem',
          padding: '1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
        }}>
          {/* CC → Bank */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <span
              style={{
                width: 10, height: 10, borderRadius: '50%',
                backgroundColor: account.color, flexShrink: 0,
              }}
            />
            <CreditCard size={14} style={{ color: '#64748b', flexShrink: 0 }} />
            <span style={{ fontWeight: 600, fontSize: '0.9375rem', flex: 1, color: '#0f172a' }}>
              {account.name}
            </span>
            <ArrowRight size={13} style={{ color: '#94a3b8' }} />
            {linkedAccount && (
              <>
                <span
                  style={{
                    width: 10, height: 10, borderRadius: '50%',
                    backgroundColor: linkedAccount.color, flexShrink: 0,
                  }}
                />
                <Landmark size={14} style={{ color: '#64748b', flexShrink: 0 }} />
                <span style={{ fontSize: '0.875rem', color: '#475569' }}>{linkedAccount.name}</span>
              </>
            )}
          </div>

          {/* Importo */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: '0.8125rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 500 }}>
              Importo
            </span>
            <span style={{
              fontFamily: "'DM Mono', ui-monospace, monospace",
              fontVariantNumeric: 'tabular-nums',
              fontSize: '1.375rem',
              fontWeight: 700,
              color: '#b45309',
            }}>
              {formatCurrency(debt)}
            </span>
          </div>

          {/* Data */}
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.8125rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 500 }}>
              Data
            </span>
            <span style={{ fontSize: '0.875rem', color: '#475569' }}>oggi, {today}</span>
          </div>
        </div>

        {/* Categoria per la transazione sul conto bancario */}
        <div className="form-group">
          <label className="form-label">Categoria addebito</label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="form-select"
          >
            <option value="">-- Seleziona categoria --</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
            ))}
          </select>
        </div>

        <div className="form-actions">
          <button type="button" onClick={onDismiss} className="btn btn-ghost btn-md">
            Salta oggi
          </button>
          <button
            type="button"
            onClick={handleSettle}
            disabled={settleMutation.isPending || debt <= 0}
            className="btn btn-primary btn-md"
          >
            {settleMutation.isPending ? 'Registrazione...' : 'Registra addebito'}
          </button>
        </div>
      </div>
    </BaseModal>
  );
}
