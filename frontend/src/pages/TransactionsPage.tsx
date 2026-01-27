import { useEffect, useState } from 'react';
import { transactionAPI,categoryAPI } from '../api/client';

import type { Transaction, Category, TransactionType } from '../types';
import { Plus, Trash2, Pencil, TrendingUp, TrendingDown } from 'lucide-react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import TransactionModal from '../components/transactions/TransactionModal';
import FilterNav from '../components/layout/FilterNav';

import matchesFilters from '../utils/filters.ts'

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
    return <div className="flex justify-center items-center h-64">Caricamento...</div>;
  }

  return (
    <div className="px-4 sm:px-0">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Transazioni</h1>
        <button
          onClick={() => {setShowModal(true); setEditingTransaction(null);}}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
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
     <div className="bg-white rounded-lg shadow divide-y">
  {transactions.length === 0 ? (
    <div className="p-8 text-center text-gray-500">
      Nessuna transazione trovata
    </div>
  ) : (
    transactions.map((transaction) => {
      //Filtro 
        if (
          !matchesFilters(transaction, {
            typeValue: filterType,
            itemType: (t) => t.type,
            searchValue: searchFilter,
            searchFields: [
              (t) => t.description,
              (t) => t.category?.name,
            ],
          })
        )
    return null;

      return (
        <div
          key={transaction.id}
          className="p-4 flex items-center justify-between hover:bg-gray-50"
        >
          <div className="flex items-center gap-4">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center ${
                transaction.type === 'INCOME'
                  ? 'bg-green-100'
                  : 'bg-red-100'
              }`}
            >
              {transaction.type === 'INCOME' ? (
                <TrendingUp className="w-5 h-5 text-green-600" />
              ) : (
                <TrendingDown className="w-5 h-5 text-red-600" />
              )}
            </div>
            <div>
              <p className="font-medium">
                {transaction.description || 'Nessuna descrizione'}
              </p>
              <p className="text-sm text-gray-500">
                {transaction.category?.name || 'Senza categoria'} •{' '}
                {format(new Date(transaction.date), 'dd MMM yyyy', {
                  locale: it,
                })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <span
              className={`text-lg font-semibold ${
                transaction.type === 'INCOME'
                  ? 'text-green-600'
                  : 'text-red-600'
              }`}
            >
              {transaction.type === 'INCOME' ? '+' : '-'}€
              {Number(transaction.amount).toFixed(2)}
            </span>

            <button
              onClick={() => handleEdit(transaction)}
              className="p-2 text-blue-600 hover:bg-blue-50 rounded"
            >
              <Pencil className="w-4 h-4" />
            </button>

            <button
              onClick={() => handleDelete(transaction.id)}
              className="p-2 text-red-600 hover:bg-red-50 rounded"
            >
              <Trash2 className="w-4 h-4" />
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
};