import { useTransactions, useDeleteTransaction } from '../hooks/useTransactions';
import { useCategories } from '../hooks/useCategories';
import type { Transaction, TransactionType } from '../types';
import { Plus, Trash2, Pencil, TrendingUp, TrendingDown } from 'lucide-react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import TransactionModal from '../components/transactions/TransactionModal';
import FilterNav from '../components/layout/FilterNav';
import matchesFilters from '../utils/filters';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import { useState } from 'react';

export default function TransactionsPage() {
  const [filterType, setFilterType] = useState<TransactionType | 'ALL'>('ALL');
  const [searchFilter, setFilterSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  // React Query hooks - gestiscono cache, loading, refetch automaticamente
  const { data: transactions = [], isLoading: transactionsLoading } = useTransactions(filterType);
  const { data: categories = [], isLoading: categoriesLoading } = useCategories();
  const deleteTransactionMutation = useDeleteTransaction();

  const isLoading = transactionsLoading || categoriesLoading;

  const handleDelete = async (id: string) => {
    if (!confirm('Sei sicuro di voler eliminare questa transazione?')) return;
    
    try {
      await deleteTransactionMutation.mutateAsync(id);
      // React Query invalida automaticamente la cache e ricarica i dati
    } catch (error) {
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

  if (isLoading) {
    return <LoadingSpinner message="Caricamento Transazioni..." />;
  }

  return (
    <div className="container-custom">
      <div className="flex-between mb-6">
        <h1 className="text-3xl font-bold text-neutral-900">Transazioni</h1>
        <button
          onClick={() => {
            setShowModal(true);
            setEditingTransaction(null);
          }}
          className="btn btn-primary btn-md"
        >
          <Plus className="icon-md" />
          Nuova Transazione
        </button>
      </div>

      {/* Filtri */}
      <FilterNav
        filterType={filterType}
        setFilterType={setFilterType}
        setSearchFilter={setFilterSearch}
      />

      {/* Lista transazioni */}
      <div className="list-card">
        {transactions.length === 0 ? (
          <div className="empty-state-card">
            <p className="empty-state-title">Nessuna transazione trovata</p>
            <p className="empty-state-description">
              Inizia aggiungendo la tua prima transazione
            </p>
            <button onClick={() => setShowModal(true)} className="btn btn-primary btn-md">
              <Plus className="icon-md" />
              Aggiungi Transazione
            </button>
          </div>
        ) : (
          transactions.map((transaction) => {
            // Filtro
            if (
              !matchesFilters(transaction, {
                typeValue: filterType,
                itemType: (t) => t.type,
                searchValue: searchFilter,
                searchFields: [(t) => t.description, (t) => t.category?.name],
              })
            )
              return null;

            return (
              <div key={transaction.id} className="transaction-card">
                <div className="transaction-card-left">
                  <div
                    className={
                      transaction.type === 'INCOME'
                        ? 'transaction-card-icon-income'
                        : 'transaction-card-icon-expense'
                    }
                  >
                    {transaction.type === 'INCOME' ? (
                      <TrendingUp className="icon-md text-success-600" />
                    ) : (
                      <TrendingDown className="icon-md text-danger-600" />
                    )}
                  </div>
                  <div className="transaction-card-info">
                    <p className="transaction-card-title">
                      {transaction.description || 'Nessuna descrizione'}
                    </p>
                    <p className="transaction-card-subtitle">
                      {transaction.category?.name || 'Senza categoria'} •{' '}
                      {format(new Date(transaction.date), 'dd MMM yyyy', {
                        locale: it,
                      })}
                    </p>
                  </div>
                </div>

                <div className="transaction-card-right">
                  <span
                    className={
                      transaction.type === 'INCOME'
                        ? 'transaction-card-amount-income'
                        : 'transaction-card-amount-expense'
                    }
                  >
                    {transaction.type === 'INCOME' ? '+' : '-'}€
                    {Number(transaction.amount).toFixed(2)}
                  </span>

                  <button
                    onClick={() => handleEdit(transaction)}
                    className="btn-icon-primary"
                  >
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
            );
          })
        )}
      </div>

      {/* Modal */}
      <TransactionModal
        isOpen={showModal}
        categories={categories}
        editingTransactionData={editingTransaction}
        onClose={handleCloseModal}
        sentFeed={() => {}} // React Query gestisce il refresh automaticamente
      />
    </div>
  );
}