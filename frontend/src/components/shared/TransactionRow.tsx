import { useState } from 'react';
import { TrendingUp, TrendingDown, ChevronRight } from 'lucide-react';
import { formatDateShort } from '../../utils/date';
import { useFormatCurrency } from '../../hooks/useFormatCurrency';
import { splitCategoriesLabel } from '../../utils/transactionDisplay';
import TransactionDetailModal from '../transactions/TransactionDetailModal';
import type { Transaction } from '../../types';

/** Riga transazione read-only (icona + descrizione/categoria·data + importo).
 *  Usata nelle liste "ultime/recenti transazioni" (Dashboard, dettaglio conto).
 *  Se la transazione è divisa (split), la riga resta pulita (mostra i nomi delle
 *  categorie) ed è cliccabile: apre un modal con la ripartizione per categoria.
 *  Per evitare il box nativo dei `button` (min-height/appearance globali) la riga
 *  cliccabile è un div con role="button", non un <button>. */
export default function TransactionRow({ transaction }: { transaction: Transaction }) {
  const { formatSignedCurrency } = useFormatCurrency();
  const [detailOpen, setDetailOpen] = useState(false);
  const isIncome = transaction.type === 'INCOME';
  const isSplit = (transaction.items?.length ?? 0) > 0;

  const clickable = isSplit
    ? {
        role: 'button' as const,
        tabIndex: 0,
        onClick: () => setDetailOpen(true),
        onKeyDown: (e: React.KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setDetailOpen(true);
          }
        },
        'aria-label': `Dettaglio transazione divisa: ${transaction.description || 'senza descrizione'}`,
      }
    : {};

  return (
    <>
      <div className={`transaction-card${isSplit ? ' is-clickable' : ''}`} {...clickable}>
        <div className="transaction-card-left">
          <div className={isIncome ? 'transaction-card-icon-income' : 'transaction-card-icon-expense'}>
            {isIncome ? <TrendingUp className="icon-md" /> : <TrendingDown className="icon-md" />}
          </div>
          <div className="transaction-card-info">
            <p className="transaction-card-title">
              {transaction.description || 'Nessuna descrizione'}
            </p>
            <p className="transaction-card-subtitle">
              {isSplit
                ? splitCategoriesLabel(transaction.items)
                : transaction.category?.name || 'Senza categoria'}{' '}
              • {formatDateShort(transaction.date)}
            </p>
          </div>
        </div>
        <div className="transaction-card-right">
          <span className={isIncome ? 'transaction-card-amount-income' : 'transaction-card-amount-expense'}>
            {formatSignedCurrency(Number(transaction.amount), transaction.type)}
          </span>
          {isSplit && <ChevronRight size={16} className="transaction-card-go-chevron" aria-hidden="true" />}
        </div>
      </div>
      {isSplit && (
        <TransactionDetailModal
          isOpen={detailOpen}
          transaction={transaction}
          onClose={() => setDetailOpen(false)}
        />
      )}
    </>
  );
}
