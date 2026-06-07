import { TrendingUp, TrendingDown } from 'lucide-react';
import { formatDateShort } from '../../utils/date';
import { useFormatCurrency } from '../../hooks/useFormatCurrency';
import type { Transaction } from '../../types';

/** Riga transazione read-only (icona + descrizione/categoria·data + importo).
 *  Usata nelle liste "ultime/recenti transazioni" (Dashboard, dettaglio conto).
 *  Il colore dell'icona arriva dalle classi `.transaction-card-icon-income/expense`,
 *  non da utility inline. Le superfici con riga più ricca (TransactionsPage:
 *  data, chip conto, azioni, espansione) restano autonome di proposito. */
export default function TransactionRow({ transaction }: { transaction: Transaction }) {
  const { formatSignedCurrency } = useFormatCurrency();
  const isIncome = transaction.type === 'INCOME';
  return (
    <div className="transaction-card">
      <div className="transaction-card-left">
        <div className={isIncome ? 'transaction-card-icon-income' : 'transaction-card-icon-expense'}>
          {isIncome ? <TrendingUp className="icon-md" /> : <TrendingDown className="icon-md" />}
        </div>
        <div className="transaction-card-info">
          <p className="transaction-card-title">
            {transaction.description || 'Nessuna descrizione'}
          </p>
          <p className="transaction-card-subtitle">
            {transaction.category?.name || 'Senza categoria'} •{' '}
            {formatDateShort(transaction.date)}
          </p>
        </div>
      </div>
      <div className="transaction-card-right">
        <span className={isIncome ? 'transaction-card-amount-income' : 'transaction-card-amount-expense'}>
          {formatSignedCurrency(Number(transaction.amount), transaction.type)}
        </span>
      </div>
    </div>
  );
}
