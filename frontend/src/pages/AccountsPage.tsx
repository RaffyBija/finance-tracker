import { useState } from 'react';
import { Lock, Plus } from 'lucide-react';
import { useAccounts, useDeleteAccount, useSetDefaultAccount } from '../hooks/useAccounts';
import { useToast } from '../contexts/ToastContext';
import AccountCard from '../components/accounts/AccountCard';
import AccountFormModal from '../components/accounts/AccountFormModal';
import ConfirmModal from '../components/shared/ConfirmModal';
import { SkeletonCardGrid, SkeletonPageHeader } from '../components/shared/Skeleton';
import type { Account } from '../types';

const MAX_FREE_ACCOUNTS = 3;

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(amount);
}

export default function AccountsPage() {
  const [showModal, setShowModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: accounts = [], isLoading } = useAccounts();
  const deleteMutation = useDeleteAccount();
  const setDefaultMutation = useSetDefaultAccount();
  const toast = useToast();

  const atLimit = accounts.length >= MAX_FREE_ACCOUNTS;

  const netWorth = accounts.reduce((sum, a) => sum + a.balance, 0);

  const handleEdit = (account: Account) => {
    setEditingAccount(account);
    setShowModal(true);
  };

  const handleOpenNew = () => {
    if (atLimit) {
      toast.info(`Hai raggiunto il limite di ${MAX_FREE_ACCOUNTS} conti del piano gratuito.`);
      return;
    }
    setEditingAccount(null);
    setShowModal(true);
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      await deleteMutation.mutateAsync(deletingId);
      toast.success('Conto eliminato');
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Errore nella eliminazione');
    } finally {
      setDeletingId(null);
    }
  };

  const handleSetDefault = async (id: string) => {
    const account = accounts.find((a) => a.id === id);
    if (account?.type === 'CREDIT_CARD') {
      toast.info('Stai impostando una carta di credito come conto principale. Verrà usata come default per le nuove transazioni.');
    }
    try {
      await setDefaultMutation.mutateAsync(id);
      toast.success('Conto principale aggiornato');
    } catch {
      toast.error('Errore nel cambio conto principale');
    }
  };

  return (
    <>
      <div className="container-custom">
        {isLoading ? (
          <>
            <SkeletonPageHeader />
            <SkeletonCardGrid cols={3} rows={1} />
          </>
        ) : (
          <>
            <div className="page-header">
              <h1 className="page-header-title">I tuoi conti</h1>
              <span style={{ fontSize: 13, color: 'var(--color-neutral-500, #64748b)' }}>
                {accounts.length}/{MAX_FREE_ACCOUNTS} conti attivi
              </span>
            </div>

            <div className="card-grid-3">
              {accounts.map((account) => (
                <AccountCard
                  key={account.id}
                  account={account}
                  onEdit={handleEdit}
                  onDelete={(id) => setDeletingId(id)}
                  onSetDefault={handleSetDefault}
                />
              ))}

              {/* Slot libero o bloccato */}
              {!atLimit ? (
                <button className="account-card-locked" onClick={handleOpenNew} style={{ cursor: 'pointer' }}>
                  <div className="account-card-locked-icon">
                    <Plus size={18} />
                  </div>
                  <span className="account-card-locked-title">Aggiungi conto</span>
                  <span className="account-card-locked-desc">
                    Conto corrente, risparmio o carta di credito
                  </span>
                </button>
              ) : (
                <div className="account-card-locked">
                  <div className="account-card-locked-icon">
                    <Lock size={18} />
                  </div>
                  <span className="account-card-locked-title">Slot bloccato</span>
                  <span className="account-card-locked-desc">
                    Hai raggiunto il limite del piano gratuito
                  </span>
                  <span className="account-card-locked-badge">Plus — presto disponibile</span>
                </div>
              )}
            </div>

            {/* Patrimonio netto */}
            {accounts.length > 0 && (
              <div className="account-net-worth" style={{ marginTop: 24 }}>
                <div>
                  <div className="account-net-worth-label">Patrimonio netto</div>
                  <div className="account-net-worth-rows">
                    {accounts.map((a) => (
                      <div key={a.id} className="account-net-worth-row">
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              backgroundColor: a.color,
                              display: 'inline-block',
                              flexShrink: 0,
                            }}
                          />
                          {a.name}
                        </span>
                        <span
                          className={`account-net-worth-row-amount ${
                            a.balance >= 0 ? 'is-asset' : 'is-liability'
                          }`}
                        >
                          {formatCurrency(a.balance)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div className="account-net-worth-label" style={{ marginBottom: 4 }}>Totale</div>
                  <div
                    className="account-net-worth-amount"
                    style={{ color: netWorth >= 0 ? '#0d9488' : '#ef4444' }}
                  >
                    {formatCurrency(netWorth)}
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {!isLoading && !atLimit && (
          <button className="fab" onClick={handleOpenNew} aria-label="Nuovo conto">
            <Plus size={22} />
            <span className="fab-label">Nuovo</span>
          </button>
        )}
      </div>

      <AccountFormModal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditingAccount(null); }}
        editingAccount={editingAccount}
      />

      <ConfirmModal
        isOpen={!!deletingId}
        title="Elimina conto"
        message="Le transazioni associate resteranno ma perderanno il collegamento al conto. Continuare?"
        confirmLabel="Elimina"
        confirmClassName="btn btn-danger btn-md"
        onConfirm={handleDelete}
        onClose={() => setDeletingId(null)}
      />
    </>
  );
}
