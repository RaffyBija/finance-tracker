import { useRecentTransactions } from '../../../hooks/useDashboard';
import TransactionRow from '../../shared/TransactionRow';
import { SkeletonList } from '../../shared/Skeleton';

// Widget "Transazioni recenti" — ultime 5 transazioni di tutti i conti.
export default function RecentTransactionsWidget() {
  const { data: recentTransactions = [], isLoading } = useRecentTransactions(5);

  if (isLoading) return <SkeletonList rows={5} />;

  return (
    <div className="card">
      <div className="widget-head">
        <h3 className="widget-title">Transazioni recenti</h3>
      </div>
      <div className="card-divided">
        {recentTransactions.length === 0 ? (
          <div className="dashboard-empty-state">Nessuna transazione recente</div>
        ) : (
          recentTransactions.map((transaction) => (
            <TransactionRow key={transaction.id} transaction={transaction} />
          ))
        )}
      </div>
    </div>
  );
}
