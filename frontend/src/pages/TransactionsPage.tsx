import { useEffect, useState } from 'react';
import { transactionAPI, categoryAPI } from '../api/client';
import type { Transaction, Category, TransactionType } from '../types';
import { Plus, Trash2, Pencil, TrendingUp, TrendingDown } from 'lucide-react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import TransactionModal from '../components/transactions/TransactionModal';
import FilterNav from '../components/layout/FilterNav';
import matchesFilters from '../utils/filters.ts';

import Loading from '../components/layout/Loading';

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [filterType, setFilterType] = useState<TransactionType | 'ALL'>('ALL');
  const [refreshFlag, setRefreshFlag] = useState(false);
  const [searchFilter, setFilterSearch] = useState('');

  useEffect(() => {
    loadData();
  }, [refreshFlag]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const params = filterType !== 'ALL' ? { type: filterType } : {};
      const [transactionsData, categoriesData] = await Promise.all([
        transactionAPI.getAll(params),
        categoryAPI.getAll(),
      ]);
      setTransactions(transactionsData);
      setCategories(categoriesData);
    } catch (error) {
      console.error('Errore nel caricamento:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Sei sicuro di voler eliminare questa transazione?')) return;
    try {
      await transactionAPI.delete(id);
      loadData();
    } catch (error) {
      alert('Errore nell\'eliminazione');
    }
  };

  const handleEdit = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setShowModal(true);
  };

  if (isLoading) {
    return (
     <Loading />
    );
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
        editingTransactionData={editingTransaction ? editingTransaction : null}
        onClose={() => setShowModal(false)}
        sentFeed={() => setRefreshFlag(!refreshFlag)}
      />
    </div>
  );
}