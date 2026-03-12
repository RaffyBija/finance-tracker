import { useTransactions, useDeleteTransaction, PAGE_SIZE } from '../hooks/useTransactions';
import { useCategories } from '../hooks/useCategories';
import type { Transaction, TransactionType } from '../types';
import { Plus, Trash2, Pencil, TrendingUp, TrendingDown } from 'lucide-react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import TransactionModal from '../components/transactions/TransactionModal';
import FilterNav from '../components/layout/FilterNav';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import { useState, useMemo } from 'react';

export default function TransactionsPage() {
  // Filtri inviati al backend
  const [filterType, setFilterType] = useState<TransactionType | 'ALL'>('ALL');
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });

  // Ricerca testuale client-side (sull'array già paginato)
  const [searchFilter, setSearchFilter] = useState('');

  // Paginazione: accumulo di pagine già caricate
  const [page, setPage] = useState(0);
  const [prevPages, setPrevPages] = useState<Transaction[]>([]);

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  const { data: currentPage = [], isLoading: transactionsLoading, isFetching } = useTransactions({
    type: filterType,
    startDate: dateRange.startDate || undefined,
    endDate: dateRange.endDate || undefined,
    page,
  });

  const { data: categories = [], isLoading: categoriesLoading } = useCategories();
  const deleteTransactionMutation = useDeleteTransaction();

  // Lista completa = pagine precedenti + pagina corrente
  const transactions = useMemo(() => {
    if (page === 0) return currentPage;
    const currentIds = new Set(currentPage.map((t) => t.id));
    return [...prevPages.filter((t) => !currentIds.has(t.id)), ...currentPage];
  }, [currentPage, prevPages, page]);

  // Filtro testo locale
  const filteredTransactions = useMemo(() => {
    if (!searchFilter.trim()) return transactions;
    const q = searchFilter.toLowerCase();
    return transactions.filter(
      (t) =>
        t.description?.toLowerCase().includes(q) ||
        t.category?.name?.toLowerCase().includes(q)
    );
  }, [transactions, searchFilter]);

  const hasMore = currentPage.length === PAGE_SIZE;

  // Reset filtri → azzera paginazione
  const handleFilterType = (type: TransactionType | 'ALL') => {
    setFilterType(type);
    setPage(0);
    setPrevPages([]);
  };

  const handleDateRange = (range: { startDate: string; endDate: string }) => {
    setDateRange(range);
    setPage(0);
    setPrevPages([]);
  };

  const handleLoadMore = () => {
    setPrevPages(transactions); // snapshot della lista corrente
    setPage((p) => p + 1);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Sei sicuro di voler eliminare questa transazione?')) return;
    try {
      await deleteTransactionMutation.mutateAsync(id);
      setPage(0);
      setPrevPages([]);
    } catch {
      alert("Errore nell'eliminazione");
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

  const isLoading = (transactionsLoading && page === 0) || categoriesLoading;

  if (isLoading) {
    return <LoadingSpinner message="Caricamento Transazioni..." />;
  }

  return (
    <div className="container-custom">

      {/* ── Header ── */}
      <div className="page-header">
        <h1 className="page-header-title">Transazioni</h1>
        <button
          onClick={() => { setShowModal(true); setEditingTransaction(null); }}
          className="btn btn-primary btn-md page-header-btn"
        >
          <Plus className="icon-md" />
          <span>Nuova Transazione</span>
        </button>
      </div>

      {/* ── Filtri ── */}
      <FilterNav
        filterType={filterType}
        setFilterType={handleFilterType}
        setSearchFilter={setSearchFilter}
        dateRange={dateRange}
        setDateRange={handleDateRange}
      />

      {/* ── Lista ── */}
      <div className="list-card">
        {filteredTransactions.length === 0 && !isFetching ? (
          <div className="empty-state-card">
            <p className="empty-state-title">Nessuna transazione trovata</p>
            <p className="empty-state-description">
              {searchFilter || dateRange.startDate || dateRange.endDate
                ? 'Prova a modificare i filtri applicati'
                : 'Inizia aggiungendo la tua prima transazione'}
            </p>
            {!searchFilter && !dateRange.startDate && !dateRange.endDate && (
              <button onClick={() => setShowModal(true)} className="btn btn-primary btn-md">
                <Plus className="icon-md" />
                Aggiungi Transazione
              </button>
            )}
          </div>
        ) : (
          filteredTransactions.map((transaction) => (
            <div key={transaction.id} className="transaction-card">

              <div className="transaction-card-left min-w-0 flex-1">
                <div className={
                  transaction.type === 'INCOME'
                    ? 'transaction-card-icon-income flex-shrink-0'
                    : 'transaction-card-icon-expense flex-shrink-0'
                }>
                  {transaction.type === 'INCOME'
                    ? <TrendingUp className="icon-md text-success-600" />
                    : <TrendingDown className="icon-md text-danger-600" />
                  }
                </div>
                <div className="transaction-card-info min-w-0">
                  <p className="transaction-card-title truncate">
                    {transaction.description || 'Nessuna descrizione'}
                  </p>
                  <p className="transaction-card-subtitle truncate">
                    {transaction.category?.name || 'Senza categoria'} •{' '}
                    {format(new Date(transaction.date), 'dd MMM yyyy', { locale: it })}
                  </p>
                </div>
              </div>

              <div className="transaction-card-right flex-shrink-0">
                <span className={
                  transaction.type === 'INCOME'
                    ? 'transaction-card-amount-income'
                    : 'transaction-card-amount-expense'
                }>
                  {transaction.type === 'INCOME' ? '+' : '-'}€
                  {Number(transaction.amount).toFixed(2)}
                </span>
                <button onClick={() => handleEdit(transaction)} className="btn-icon-primary">
                  <Pencil className="icon-sm" />
                </button>
                <button
                  onClick={() => handleDelete(transaction.id)}
                  className="btn-icon-danger"
                  disabled={deleteTransactionMutation.isPending}
                >
                  <Trash2 className="icon-sm" />
                </button>
              </div>

            </div>
          ))
        )}
      </div>

      {/* ── Carica altro ── */}
      {hasMore && !searchFilter && (
        <div className="flex flex-col items-center gap-2 mt-4 mb-2">
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

      {/* Contatore */}
      {filteredTransactions.length > 0 && (
        <p className="text-center text-xs text-neutral-400 mt-2 mb-6">
          {filteredTransactions.length} transazion{filteredTransactions.length === 1 ? 'e' : 'i'} visualizzat{filteredTransactions.length === 1 ? 'a' : 'e'}
          {hasMore && !searchFilter && ' · altri risultati disponibili'}
        </p>
      )}

      <TransactionModal
        isOpen={showModal}
        categories={categories}
        editingTransactionData={editingTransaction}
        onClose={handleCloseModal}
        sentFeed={() => {}}
      />
    </div>
  );
}