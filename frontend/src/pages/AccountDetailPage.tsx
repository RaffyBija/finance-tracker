import { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Pencil, Trash2, CreditCard, Landmark, Star, ArrowLeftRight,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { transactionAPI } from '../api/client';
import { useAccount, useAccounts, useDeleteAccount, useSetDefaultAccount } from '../hooks/useAccounts';
import { useTransactions } from '../hooks/useTransactions';
import { useProjectedBalance } from '../hooks/useDashboard';
import { useToast } from '../contexts/ToastContext';
import AccountFormModal from '../components/accounts/AccountFormModal';
import TransferModal from '../components/transactions/TransferModal';
import CycleHistoryList from '../components/accounts/CycleHistoryList';
import ConfirmModal from '../components/shared/ConfirmModal';
import TransactionRow from '../components/shared/TransactionRow';
import Skeleton, { SkeletonPageHeader, SkeletonCardGrid } from '../components/shared/Skeleton';
import { useFormatCurrency } from '../hooks/useFormatCurrency';
import { daysUntilBilling } from '../utils/billing';
import type { Account } from '../types';

export default function AccountDetailPage() {
  const { formatCurrency } = useFormatCurrency();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();

  const { data: account, isLoading, isError } = useAccount(id);
  const { data: allAccounts = [] } = useAccounts();
  const deleteMutation = useDeleteAccount();
  const setDefaultMutation = useSetDefaultAccount();

  const [showEdit, setShowEdit] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isCC = account?.type === 'CREDIT_CARD';
  const bankAccountsCount = allAccounts.filter((a) => a.type === 'BANK').length;

  // Range mese corrente per le flashcard entrate/uscite
  const monthRange = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    return { start: start.toISOString(), end: end.toISOString() };
  }, []);

  const { data: monthTx = [], isLoading: monthLoading } = useQuery({
    queryKey: ['transactions', 'account-month', id, monthRange.start],
    queryFn: () => transactionAPI.getAll({ accountId: id, startDate: monthRange.start, endDate: monthRange.end, limit: 1000 }),
    enabled: !!id,
    staleTime: 60 * 1000,
  });

  const monthIncome = monthTx.filter((t) => t.type === 'INCOME').reduce((s, t) => s + Number(t.amount), 0);
  const monthExpense = monthTx.filter((t) => t.type === 'EXPENSE').reduce((s, t) => s + Number(t.amount), 0);

  const { data: recentTx = [] } = useTransactions({ accountId: id, page: 0 });
  const recent = recentTx.slice(0, 6);

  // Proiezione fine mese (solo conti bancari)
  const { data: projection } = useProjectedBalance({ months: 1, accountId: id }, !!id && !isCC);

  const handleDelete = async () => {
    if (!account) return;
    try {
      await deleteMutation.mutateAsync(account.id);
      toast.success('Conto eliminato');
      navigate('/accounts');
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Errore nella eliminazione');
    } finally {
      setConfirmDelete(false);
    }
  };

  const handleSetDefault = async () => {
    if (!account) return;
    try {
      await setDefaultMutation.mutateAsync(account.id);
      toast.success('Conto principale aggiornato');
    } catch {
      toast.error('Errore nel cambio conto principale');
    }
  };

  if (isLoading) {
    return (
      <div className="container-custom">
        <SkeletonPageHeader />
        <SkeletonCardGrid cols={3} rows={1} />
      </div>
    );
  }

  if (isError || !account) {
    return (
      <div className="container-custom">
        <button className="account-detail-back" onClick={() => navigate('/accounts')}>
          <ArrowLeft className="icon-sm" /> Conti
        </button>
        <p className="account-detail-error">Conto non trovato.</p>
      </div>
    );
  }

  // Back contestuale: da una carta collegata si torna al suo conto, altrimenti alla home.
  const backTo = account.linkedAccount ? `/accounts/${account.linkedAccount.id}` : '/accounts';
  const backLabel = account.linkedAccount ? account.linkedAccount.name : 'Conti';

  const balance = account.balance;
  const debt = isCC ? Math.abs(balance) : null;
  const balanceCls = isCC || balance < 0 ? 'is-negative' : balance === 0 ? 'is-zero' : 'is-positive';
  const pct = isCC && account.creditLimit ? (debt! / account.creditLimit) * 100 : 0;
  const barCls = pct >= 80 ? 'is-danger' : pct >= 50 ? 'is-warn' : 'is-ok';
  const billing = isCC && account.billingDay ? daysUntilBilling(account.billingDay) : null;

  return (
    <div className="container-custom">
      <button className="account-detail-back" onClick={() => navigate(backTo)}>
        <ArrowLeft className="icon-sm" /> {backLabel}
      </button>

      {/* ── Header ── */}
      <div className="account-detail-header">
        <div className="account-detail-identity">
          <span className="account-detail-dot" style={{ backgroundColor: account.color }} />
          <div className="account-detail-name-group">
            <h1 className="account-detail-name">{account.name}</h1>
            <span className={isCC ? 'badge badge-info' : 'badge badge-neutral'}>
              {isCC ? 'Carta di credito' : 'Conto'}
            </span>
          </div>
        </div>
        <div className="account-detail-actions">
          {!isCC && bankAccountsCount >= 2 && (
            <button onClick={() => setShowTransfer(true)} className="btn-icon-primary" title="Trasferisci" aria-label="Trasferisci">
              <ArrowLeftRight className="icon-sm" />
            </button>
          )}
          {!account.isDefault && (
            <button onClick={handleSetDefault} className="btn-icon-primary" title="Imposta come principale" aria-label="Imposta come principale">
              <Star className="icon-sm" />
            </button>
          )}
          <button onClick={() => setShowEdit(true)} className="btn-icon-primary" title="Modifica conto" aria-label="Modifica conto">
            <Pencil className="icon-sm" />
          </button>
          {!account.isDefault && (
            <button onClick={() => setConfirmDelete(true)} className="btn-icon-danger" title="Elimina conto" aria-label="Elimina conto">
              <Trash2 className="icon-sm" />
            </button>
          )}
        </div>
      </div>

      {/* ── Hero saldo ── */}
      <div className="account-detail-hero">
        <span className="account-detail-hero-label">{isCC ? 'Debito attuale' : 'Saldo'}</span>
        <span className={`account-detail-hero-amount ${balanceCls}`}>
          {isCC ? formatCurrency(debt!) : formatCurrency(balance)}
        </span>
        <span className="account-detail-hero-meta">
          {isCC ? <CreditCard className="icon-xs" /> : <Landmark className="icon-xs" />}
          {account.isDefault ? 'Conto principale' : `${account._count?.transactions ?? recentTx.length} transazioni`}
        </span>

        {isCC && account.creditLimit && (
          <div className="account-card-bar-section account-detail-hero-bar">
            <div className="account-card-bar-meta">
              <span>Utilizzo: {Math.round(pct)}%</span>
              <span>Limite: {formatCurrency(account.creditLimit)}</span>
            </div>
            <div className="account-card-bar-track">
              <div className={`account-card-bar-fill ${barCls}`} style={{ width: `${Math.min(pct, 100)}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* ── Flashcards ── */}
      <div className="account-flashcards">
        <div className="account-flashcard">
          <span className="account-flashcard-label">Entrate del mese</span>
          {monthLoading
            ? <Skeleton className="h-6 w-24" />
            : <span className="account-flashcard-value is-income">{formatCurrency(monthIncome)}</span>}
        </div>
        <div className="account-flashcard">
          <span className="account-flashcard-label">Uscite del mese</span>
          {monthLoading
            ? <Skeleton className="h-6 w-24" />
            : <span className="account-flashcard-value is-expense">{formatCurrency(monthExpense)}</span>}
        </div>
        {!isCC && (
          <div className="account-flashcard">
            <span className="account-flashcard-label">Proiezione fine mese</span>
            <span className="account-flashcard-value">
              {projection ? formatCurrency(projection.projectedBalance) : '—'}
            </span>
          </div>
        )}
        {isCC && billing !== null && (
          <div className="account-flashcard">
            <span className="account-flashcard-label">Prossimo addebito</span>
            <span className="account-flashcard-value">
              {billing === 0 ? 'Oggi' : `tra ${billing} ${billing === 1 ? 'giorno' : 'giorni'}`}
            </span>
          </div>
        )}
      </div>

      {/* ── Storico cicli (solo CC) ── */}
      {isCC && (
        <>
          <h2 className="account-detail-section-title">Storico cicli</h2>
          <div className="card account-detail-cycles">
            <CycleHistoryList accountId={account.id} billingDay={account.billingDay} />
          </div>
        </>
      )}

      {/* ── Carte collegate (solo conti bancari) ── */}
      {!isCC && (account.linkedCC?.length ?? 0) > 0 && (
        <>
          <h2 className="account-detail-section-title">Carte collegate</h2>
          <div className="account-linked-cards">
            {account.linkedCC!.map((cc) => {
              const ccDebt = Math.abs((cc as any).balance ?? 0);
              return (
                <button
                  key={cc.id}
                  className="account-linked-card"
                  onClick={() => navigate(`/accounts/${cc.id}`)}
                >
                  <span className="account-linked-card-icon" style={{ backgroundColor: cc.color }}>
                    <CreditCard className="icon-sm" />
                  </span>
                  <span className="account-linked-card-info">
                    <span className="account-linked-card-name">{cc.name}</span>
                    <span className="account-linked-card-debt">{formatCurrency(ccDebt)}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* ── Ultime transazioni ── */}
      <h2 className="account-detail-section-title">Ultime transazioni</h2>
      <div className="card card-divided">
        {recent.length === 0 ? (
          <div className="dashboard-empty-state">Nessuna transazione su questo conto</div>
        ) : (
          recent.map((transaction) => (
            <TransactionRow key={transaction.id} transaction={transaction} />
          ))
        )}
      </div>

      <AccountFormModal
        isOpen={showEdit}
        onClose={() => setShowEdit(false)}
        editingAccount={account as Account}
      />

      <TransferModal
        isOpen={showTransfer}
        onClose={() => setShowTransfer(false)}
        defaultFromAccountId={account.id}
      />

      <ConfirmModal
        isOpen={confirmDelete}
        title="Elimina conto"
        message="Le transazioni associate resteranno ma perderanno il collegamento al conto. Continuare?"
        confirmLabel="Elimina"
        confirmClassName="btn btn-danger btn-md"
        onConfirm={handleDelete}
        onClose={() => setConfirmDelete(false)}
      />
    </div>
  );
}
