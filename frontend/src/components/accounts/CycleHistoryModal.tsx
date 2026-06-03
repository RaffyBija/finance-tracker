import { CalendarClock, CheckCircle2, CircleDashed } from 'lucide-react';
import BaseModal from '../layout/ModalBase';
import { useBillingCycles } from '../../hooks/useAccounts';
import type { Account } from '../../types';

interface CycleHistoryModalProps {
  isOpen: boolean;
  account: Account | null;
  onClose: () => void;
}

function fmt(n: number) {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);
}

function fmtRange(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  return `${s.toLocaleDateString('it-IT', opts)} – ${e.toLocaleDateString('it-IT', { ...opts, year: 'numeric' })}`;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function CycleHistoryModal({ isOpen, account, onClose }: CycleHistoryModalProps) {
  const { data: cycles = [], isLoading } = useBillingCycles(account?.id ?? null, isOpen);

  if (!isOpen || !account) return null;

  return (
    <BaseModal isOpen={isOpen} title={`Cicli di fatturazione · ${account.name}`} onClose={onClose}>
      <div className="modal-form">
        <p className="recurring-due-subtitle" style={{ fontSize: '0.9375rem' }}>
          Ogni spesa appartiene al ciclo della sua data. I cicli chiusi diventano addebiti
          pianificati; il ciclo aperto è il debito che stai accumulando.
        </p>

        {isLoading ? (
          <p style={{ color: '#64748b', fontSize: '0.875rem' }}>Caricamento…</p>
        ) : cycles.length === 0 ? (
          <p style={{ color: '#64748b', fontSize: '0.875rem' }}>Nessun ciclo registrato.</p>
        ) : (
          <div className="cycle-history-list">
            {cycles.map((c) => {
              const isOpen = c.status === 'OPEN';
              const paid = c.planned?.isPaid ?? false;
              return (
                <div key={c.id} className={`cycle-history-item${isOpen ? ' is-open' : ''}`}>
                  <div className="cycle-history-item-head">
                    <span className="cycle-history-range">
                      <CalendarClock size={14} />
                      {fmtRange(c.periodStart, c.periodEnd)}
                    </span>
                    <span className={`badge ${isOpen ? 'badge-info' : paid ? 'badge-success' : 'badge-warning'}`}>
                      {isOpen ? 'In corso' : paid ? 'Pagato' : 'Da pagare'}
                    </span>
                  </div>

                  <div className="cycle-history-item-body">
                    <span className="cycle-history-amount">{fmt(c.debtAmount)}</span>
                    {!isOpen && c.billingDate && (
                      <span className="cycle-history-meta">
                        {paid ? <CheckCircle2 size={13} /> : <CircleDashed size={13} />}
                        Addebito {fmtDate(c.billingDate)}
                      </span>
                    )}
                    {isOpen && (
                      <span className="cycle-history-meta">debito in accumulo</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="form-actions">
          <button type="button" onClick={onClose} className="btn btn-ghost btn-md">
            Chiudi
          </button>
        </div>
      </div>
    </BaseModal>
  );
}
