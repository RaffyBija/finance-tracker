// frontend/src/pages/TransactionsPage.tsx

import { useTransactions, useDeleteTransaction, useDeleteTransfer, PAGE_SIZE } from '../hooks/useTransactions';
import { useCategories } from '../hooks/useCategories';
import { useAccounts } from '../hooks/useAccounts';
import type { Transaction, TransactionType } from '../types';
import { Plus, TrendingUp, TrendingDown, ChevronRight, ArrowLeftRight } from 'lucide-react';
import { formatDateShort } from '../utils/date';
import { splitCategoriesLabel } from '../utils/transactionDisplay';
import TransactionModal from '../components/transactions/TransactionModal';
import TransferModal from '../components/transactions/TransferModal';
import TransactionDetailModal from '../components/transactions/TransactionDetailModal';
import ConfirmModal from '../components/shared/ConfirmModal';
import FilterNav from '../components/layout/FilterNav';
import { SkeletonPageHeader, SkeletonList } from '../components/shared/Skeleton';
import { useToast } from '../contexts/ToastContext';
import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useFormatCurrency } from '../hooks/useFormatCurrency';

export default function TransactionsPage() {
  const { formatSignedCurrency, formatCurrency } = useFormatCurrency();
  // ── Filtri inviati al backend ──
  const [filterType, setFilterType] = useState<TransactionType | 'ALL'>('ALL');
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });
  const [accountFilter, setAccountFilter] = useState<string>('ALL');

  // ── Ricerca testuale server-side con debounce ──
  const [searchInput, setSearchInput] = useState('');   // valore immediato (input)
  const [search, setSearch] = useState('');             // valore debouncato (API)

  // ── Paginazione: accumulo di pagine già caricate ──
  const [page, setPage] = useState(0);
  const [prevPages, setPrevPages] = useState<Transaction[]>([]);

  // ── Modal ──
  const [showModal, setShowModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [editingTransfer, setEditingTransfer] = useState<Transaction | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  // Transazione di cui è aperto il modal di dettaglio (qualsiasi tipo).
  const [detailTx, setDetailTx] = useState<Transaction | null>(null);
  const [deletingTransferId, setDeletingTransferId] = useState<string | null>(null);

  const toast = useToast();

  // Deep-link "?new=1" (es. dalla CTA dell'empty state Spese per categoria):
  // apre il modale nuova transazione una volta sola e ripulisce il parametro.
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setEditingTransaction(null);
      setShowModal(true);
      const next = new URLSearchParams(searchParams);
      next.delete('new');
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  // Debounce: aggiorna il valore API 400ms dopo l'ultima digitazione e resetta la paginazione
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
      setPage(0);
      setPrevPages([]);
    }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data: currentPage = [], isLoading: transactionsLoading, isFetching } = useTransactions({
    type: filterType,
    startDate: dateRange.startDate || undefined,
    endDate: dateRange.endDate || undefined,
    search: search || undefined,
    page,
    accountId: accountFilter !== 'ALL' ? accountFilter : undefined,
  });

  const { data: categories = [], isLoading: categoriesLoading } = useCategories();
  const { data: accounts = [] } = useAccounts();
  const deleteTransactionMutation = useDeleteTransaction();
  const deleteTransferMutation = useDeleteTransfer();

  const bankAccountsCount = accounts.filter((a) => a.type === 'BANK').length;

  // Lista completa = pagine precedenti + pagina corrente
  const transactions = useMemo(() => {
    if (page === 0) return currentPage;
    const currentIds = new Set(currentPage.map((t) => t.id));
    return [...prevPages.filter((t) => !currentIds.has(t.id)), ...currentPage];
  }, [currentPage, prevPages, page]);

  // Fonde le due gambe di un trasferimento in una sola riga "origine → destinazione".
  // Si fonde solo in vista completa (nessun filtro conto/tipo): in quel caso
  // entrambe le gambe sono presenti e il rappresentante è la gamba EXPENSE
  // (account=origine, peer=destinazione). Con un filtro tipo/conto attivo compare
  // una sola gamba: la teniamo così com'è e la mostriamo con prospettiva direzionale.
  // Fonde le gambe solo in vista completa (nessun filtro): solo così entrambe le
  // gambe sono garantite in pagina e il rappresentante è la gamba EXPENSE.
  const mergeTransfers = accountFilter === 'ALL' && filterType === 'ALL' && !search
    && !dateRange.startDate && !dateRange.endDate;
  const displayItems = useMemo(() => {
    if (!mergeTransfers) return transactions;
    const seen = new Set<string>();
    const result: Transaction[] = [];
    for (const t of transactions) {
      if (!t.transferId) { result.push(t); continue; }
      if (seen.has(t.transferId)) continue;
      seen.add(t.transferId);
      const rep = transactions.find((x) => x.transferId === t.transferId && x.type === 'EXPENSE') ?? t;
      result.push(rep);
    }
    return result;
  }, [transactions, mergeTransfers]);

  const hasMore = currentPage.length === PAGE_SIZE;

  // ── Solo il primissimo caricamento mostra lo skeleton ──
  const isFirstLoad = (transactionsLoading && page === 0) || categoriesLoading;

  // ── Handlers ──

  const handleFilterType = (type: TransactionType | 'ALL') => {
    setFilterType(type);
    setPage(0);
    setPrevPages([]);
  };

  const handleAccountFilter = (accountId: string) => {
    setAccountFilter(accountId);
    setPage(0);
    setPrevPages([]);
  };

  const handleDateRange = (range: { startDate: string; endDate: string }) => {
    setDateRange(range);
    setPage(0);
    setPrevPages([]);
  };

  const handleNewTransaction = () => {
    setShowModal(true);
    setEditingTransaction(null);
  };

  const handleLoadMore = () => {
    setPrevPages(transactions);
    setPage((p) => p + 1);
  };

  const handleConfirmDelete = async () => {
    if (!deletingId) return;
    try {
      await deleteTransactionMutation.mutateAsync(deletingId);
      setPage(0);
      setPrevPages([]);
      toast.success('Transazione eliminata');
      setDeletingId(null);
    } catch {
      toast.error("Errore nell'eliminazione");
    }
  };

  const handleConfirmDeleteTransfer = async () => {
    if (!deletingTransferId) return;
    try {
      await deleteTransferMutation.mutateAsync(deletingTransferId);
      setPage(0);
      setPrevPages([]);
      toast.success('Trasferimento eliminato');
      setDeletingTransferId(null);
    } catch {
      toast.error("Errore nell'eliminazione");
    }
  };

  const handleEdit = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setShowModal(true);
  };

  const handleNewTransfer = () => {
    setEditingTransfer(null);
    setShowTransferModal(true);
  };

  const handleEditTransfer = (transaction: Transaction) => {
    setEditingTransfer(transaction);
    setShowTransferModal(true);
  };

  const handleCloseTransferModal = () => {
    setShowTransferModal(false);
    setEditingTransfer(null);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingTransaction(null);
  };

  return (
    <div className="container-custom">

      {/* ── Header ── */}
      {isFirstLoad ? (
        <SkeletonPageHeader />
      ) : (
        <div className="page-header">
          <h1 className="page-header-title">Transazioni</h1>
          {bankAccountsCount >= 2 && (
            <button
              onClick={handleNewTransfer}
              className="btn btn-secondary btn-md page-header-btn"
            >
              <ArrowLeftRight className="icon-md" />
              Trasferisci
            </button>
          )}
        </div>
      )}

      {/* ── Filtri — visibili appena i dati sono pronti ── */}
      {!isFirstLoad && (
        <FilterNav
          filterType={filterType}
          setFilterType={handleFilterType}
          setSearchFilter={setSearchInput}
          dateRange={dateRange}
          setDateRange={handleDateRange}
        />
      )}

      {/* ── Filtro per conto (solo se ci sono più conti) ── */}
      {!isFirstLoad && accounts.length > 1 && (
        <div className="account-filter-pills">
          <button
            className={`account-filter-pill${accountFilter === 'ALL' ? ' is-active' : ''}`}
            onClick={() => handleAccountFilter('ALL')}
          >
            Tutti i conti
          </button>
          {accounts.map((account) => (
            <button
              key={account.id}
              className={`account-filter-pill${accountFilter === account.id ? ' is-active' : ''}`}
              onClick={() => handleAccountFilter(account.id)}
            >
              <span
                className="account-filter-pill-dot"
                style={{ backgroundColor: account.color }}
              />
              {account.name}
            </button>
          ))}
        </div>
      )}

      {/* ── Lista ── */}
      {isFirstLoad ? (
        <SkeletonList rows={8} />
      ) : (
        <div className="list-card">
          {transactions.length === 0 && !isFetching ? (
            <div className="empty-state-card">
              <p className="empty-state-title">Nessuna transazione trovata</p>
              <p className="empty-state-description">
                {search || dateRange.startDate || dateRange.endDate
                  ? 'Prova a modificare i filtri applicati'
                  : 'Inizia aggiungendo la tua prima transazione'}
              </p>
              {!search && !dateRange.startDate && !dateRange.endDate && (
                <button
                  onClick={handleNewTransaction}
                  className="btn btn-primary btn-md"
                >
                  <Plus className="icon-md" />
                  Aggiungi Transazione
                </button>
              )}
            </div>
          ) : (
            displayItems.map((transaction) => {
              const isTransfer = !!transaction.transferId;
              const peerName = transaction.transferPeer?.name ?? '—';
              // Ruoli origine/destinazione derivati dal tipo della gamba: EXPENSE è
              // sempre l'origine (questo conto), INCOME la destinazione. Vale sia per
              // la riga fusa (rappresentante EXPENSE) sia per una singola gamba in
              // vista filtrata, dove la gamba INCOME ha questo conto = destinazione.
              const transferFrom = transaction.type === 'EXPENSE' ? transaction.account : transaction.transferPeer;
              const transferTo = transaction.type === 'EXPENSE' ? transaction.transferPeer : transaction.account;
              // Sottotitolo del trasferimento: riga fusa → "origine → destinazione";
              // gamba singola in vista filtrata → prospettiva del conto.
              let transferSubtitle = '';
              if (isTransfer) {
                if (mergeTransfers) {
                  transferSubtitle = `${transferFrom?.name ?? '—'} → ${transferTo?.name ?? '—'}`;
                } else {
                  transferSubtitle = transaction.type === 'EXPENSE' ? `→ ${peerName}` : `da ${peerName}`;
                }
              }
              return (
                <div
                  key={transaction.id}
                  className="transaction-card-wrap"
                  role="button"
                  tabIndex={0}
                  onClick={() => setDetailTx(transaction)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setDetailTx(transaction);
                    }
                  }}
                  aria-label={`Dettaglio: ${isTransfer ? 'Trasferimento' : (transaction.description || 'transazione')}`}
                >
                  {/* ── Riga (apre il modal di dettaglio) ── */}
                  <div className="transaction-card">
                    <div className="transaction-card-left">
                      <div className={isTransfer ? 'transaction-card-icon-transfer' : transaction.type === 'INCOME' ? 'transaction-card-icon-income' : 'transaction-card-icon-expense'}>
                        {isTransfer
                          ? <ArrowLeftRight className="icon-md" />
                          : transaction.type === 'INCOME'
                            ? <TrendingUp className="icon-md" />
                            : <TrendingDown className="icon-md" />
                        }
                      </div>
                      <div className="transaction-card-info">
                        <p className="transaction-card-title">
                          {isTransfer ? 'Trasferimento' : (transaction.description || 'Nessuna descrizione')}
                        </p>
                        <p className="transaction-card-subtitle">
                          <span className="transaction-card-meta-category">
                            {isTransfer
                              ? transferSubtitle
                              : (transaction.items?.length ?? 0) > 0
                                ? splitCategoriesLabel(transaction.items)
                                : (transaction.category?.name || 'Senza categoria')}
                          </span>
                          <span className="transaction-card-meta-sep" aria-hidden="true">·</span>
                          <span className="transaction-card-meta-date">
                            {formatDateShort(transaction.date)}
                          </span>
                          {!isTransfer && accounts.length > 1 && transaction.account && (
                            <span className="transaction-card-subtitle-account">
                              <span
                                className="transaction-card-subtitle-dot"
                                style={{ backgroundColor: transaction.account.color }}
                              />
                              {transaction.account.name}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="transaction-card-right">
                      <span className={isTransfer ? 'transaction-card-amount-transfer' : transaction.type === 'INCOME' ? 'transaction-card-amount-income' : 'transaction-card-amount-expense'}>
                        {isTransfer
                          ? formatCurrency(Number(transaction.amount))
                          : formatSignedCurrency(Number(transaction.amount), transaction.type)}
                      </span>
                      <ChevronRight size={14} className="transaction-card-go-chevron" aria-hidden="true" />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── Carica altro ── */}
      {!isFirstLoad && hasMore && (
        <div className="list-pagination">
          <button
            onClick={handleLoadMore}
            disabled={isFetching}
            className="btn btn-outline-primary btn-md"
          >
            {isFetching ? (
              <span className="btn-spinner-label">
                <span className="btn-spinner" />
                Caricamento...
              </span>
            ) : (
              'Visualizza altro'
            )}
          </button>
        </div>
      )}

      {/* ── Contatore risultati ── */}
      {!isFirstLoad && transactions.length > 0 && (
        <p className="list-result-count">
          {transactions.length} transazion{transactions.length === 1 ? 'e' : 'i'} visualizzat{transactions.length === 1 ? 'a' : 'e'}
          {hasMore && ' · altri risultati disponibili'}
        </p>
      )}

      {/* ── Floating Action Button ── */}
      <button className="fab" onClick={handleNewTransaction} aria-label="Nuova transazione">
        <Plus size={22} />
        <span className="fab-label">Nuova</span>
      </button>

      {/* ── Modal ── */}
      <TransactionModal
        isOpen={showModal}
        categories={categories}
        editingTransactionData={editingTransaction}
        onClose={handleCloseModal}
        sentFeed={() => {}}
      />

      <TransferModal
        isOpen={showTransferModal}
        editingTransfer={editingTransfer}
        onClose={handleCloseTransferModal}
      />

      <TransactionDetailModal
        isOpen={!!detailTx}
        transaction={detailTx}
        onClose={() => setDetailTx(null)}
        onEdit={() => {
          const tx = detailTx;
          setDetailTx(null);
          if (!tx) return;
          if (tx.transferId) handleEditTransfer(tx);
          else handleEdit(tx);
        }}
        onDelete={() => {
          const tx = detailTx;
          setDetailTx(null);
          if (!tx) return;
          if (tx.transferId) setDeletingTransferId(tx.transferId);
          else setDeletingId(tx.id);
        }}
      />

      <ConfirmModal
        isOpen={!!deletingId}
        title="Elimina transazione"
        message="Sei sicuro di voler eliminare questa transazione? L'operazione non può essere annullata."
        confirmLabel="Elimina"
        isPending={deleteTransactionMutation.isPending}
        onConfirm={handleConfirmDelete}
        onClose={() => setDeletingId(null)}
      />

      <ConfirmModal
        isOpen={!!deletingTransferId}
        title="Elimina trasferimento"
        message="Sei sicuro di voler eliminare questo trasferimento? Verranno rimossi entrambi i movimenti collegati. L'operazione non può essere annullata."
        confirmLabel="Elimina"
        isPending={deleteTransferMutation.isPending}
        onConfirm={handleConfirmDeleteTransfer}
        onClose={() => setDeletingTransferId(null)}
      />

    </div>
  );
}