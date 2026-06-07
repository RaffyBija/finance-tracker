// frontend/src/pages/TransactionsPage.tsx

import { useTransactions, useDeleteTransaction, PAGE_SIZE } from '../hooks/useTransactions';
import { useCategories } from '../hooks/useCategories';
import { useAccounts } from '../hooks/useAccounts';
import type { Transaction, TransactionType } from '../types';
import { Plus, Trash2, Pencil, TrendingUp, TrendingDown, ChevronDown } from 'lucide-react';
import { formatDateShort, formatDateLong } from '../utils/date';
import TransactionModal from '../components/transactions/TransactionModal';
import ConfirmModal from '../components/shared/ConfirmModal';
import FilterNav from '../components/layout/FilterNav';
import { SkeletonPageHeader, SkeletonList } from '../components/shared/Skeleton';
import { useToast } from '../contexts/ToastContext';
import { useState, useMemo, useEffect } from 'react';
import { useFormatCurrency } from '../hooks/useFormatCurrency';

export default function TransactionsPage() {
  const { formatSignedCurrency } = useFormatCurrency();
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

  // ── Espansione riga ──
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const toggleExpand = (id: string) => setExpandedId(prev => prev === id ? null : id);

  // ── Modal ──
  const [showModal, setShowModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const toast = useToast();

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

  // Lista completa = pagine precedenti + pagina corrente
  const transactions = useMemo(() => {
    if (page === 0) return currentPage;
    const currentIds = new Set(currentPage.map((t) => t.id));
    return [...prevPages.filter((t) => !currentIds.has(t.id)), ...currentPage];
  }, [currentPage, prevPages, page]);

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

  const handleEdit = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setShowModal(true);
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
            transactions.map((transaction) => {
              const isExpanded = expandedId === transaction.id;
              return (
                <div
                  key={transaction.id}
                  className={`transaction-card-wrap${isExpanded ? ' is-expanded' : ''}`}
                  onClick={() => toggleExpand(transaction.id)}
                >
                  {/* ── Riga compatta (sempre visibile) ── */}
                  <div className="transaction-card">
                    <div className="transaction-card-left">
                      <div className={transaction.type === 'INCOME' ? 'transaction-card-icon-income' : 'transaction-card-icon-expense'}>
                        {transaction.type === 'INCOME'
                          ? <TrendingUp className="icon-md" />
                          : <TrendingDown className="icon-md" />
                        }
                      </div>
                      <div className="transaction-card-info">
                        <p>{formatDateShort(transaction.date)}</p>
                        <p className="transaction-card-title">
                          {transaction.description || 'Nessuna descrizione'}
                        </p>
                        <p className="transaction-card-subtitle">
                          {transaction.category?.name || 'Senza categoria'}
                          {accounts.length > 1 && transaction.account && (
                            <span style={{ marginLeft: 6, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                              <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: transaction.account.color, display: 'inline-block' }} />
                              {transaction.account.name}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="transaction-card-right">
                      <span className={transaction.type === 'INCOME' ? 'transaction-card-amount-income' : 'transaction-card-amount-expense'}>
                        {formatSignedCurrency(Number(transaction.amount), transaction.type)}
                      </span>
                      {/* Su mobile le azioni vanno nel pannello espanso */}
                      <div className="transaction-card-actions">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleEdit(transaction); }}
                          className="btn-icon-primary"
                          title="Modifica transazione"
                          aria-label="Modifica transazione"
                        >
                          <Pencil className="icon-sm" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeletingId(transaction.id); }}
                          className="btn-icon-danger"
                          title="Elimina transazione"
                          aria-label="Elimina transazione"
                        >
                          <Trash2 className="icon-sm" />
                        </button>
                      </div>
                      <ChevronDown
                        size={14}
                        className={`transaction-card-chevron${isExpanded ? ' is-open' : ''}`}
                      />
                    </div>
                  </div>

                  {/* ── Pannello dettaglio (espandibile) ── */}
                  <div className={`transaction-card-detail${isExpanded ? ' is-open' : ''}`}>
                    <div className="transaction-card-detail-inner">
                      {/* Griglia dettagli — solo mobile (desktop ha già tutto nel compact row) */}
                      <div className="transaction-card-detail-body">
                        <div className="transaction-card-detail-field">
                          <span className="transaction-card-detail-label">Descrizione</span>
                          <span className="transaction-card-detail-value">
                            {transaction.description || 'Nessuna descrizione'}
                          </span>
                        </div>
                        <div className="transaction-card-detail-field">
                          <span className="transaction-card-detail-label">Importo</span>
                          <span className={`transaction-card-detail-amount ${transaction.type === 'INCOME' ? 'transaction-card-detail-amount-income' : 'transaction-card-detail-amount-expense'}`}>
                            {formatSignedCurrency(Number(transaction.amount), transaction.type)}
                          </span>
                        </div>
                        <div className="transaction-card-detail-field">
                          <span className="transaction-card-detail-label">Categoria</span>
                          <span className="transaction-card-detail-value">
                            {transaction.category?.name || 'Senza categoria'}
                          </span>
                        </div>
                        <div className="transaction-card-detail-field">
                          <span className="transaction-card-detail-label">Data</span>
                          <span className="transaction-card-detail-value">
                            {formatDateLong(transaction.date)}
                          </span>
                        </div>
                        {transaction.account && (
                          <div className="transaction-card-detail-field">
                            <span className="transaction-card-detail-label">Conto</span>
                            <span className="transaction-card-detail-value transaction-card-detail-account">
                              <span className="transaction-card-detail-dot" style={{ backgroundColor: transaction.account.color }} />
                              {transaction.account.name}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Azioni — sempre visibili nel pannello su tutti i breakpoint */}
                      <div className="transaction-card-detail-actions">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleEdit(transaction); }}
                          className="btn btn-secondary btn-sm"
                        >
                          <Pencil size={14} /> Modifica
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeletingId(transaction.id); }}
                          className="btn btn-danger-outline btn-sm"
                        >
                          <Trash2 size={14} /> Elimina
                        </button>
                      </div>
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
            className="btn btn-outline-primary btn-md min-w-[200px]"
          >
            {isFetching ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
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

      <ConfirmModal
        isOpen={!!deletingId}
        title="Elimina transazione"
        message="Sei sicuro di voler eliminare questa transazione? L'operazione non può essere annullata."
        confirmLabel="Elimina"
        isPending={deleteTransactionMutation.isPending}
        onConfirm={handleConfirmDelete}
        onClose={() => setDeletingId(null)}
      />

    </div>
  );
}