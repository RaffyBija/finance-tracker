import { useQuery } from '@tanstack/react-query';
import { recurringApi } from '../../api/recurring';
import type { RecurringTransaction } from '../../types';
import { SkeletonCard } from '../shared/Skeleton';
import { RepeatIcon } from 'lucide-react';
import { useFormatCurrency } from '../../hooks/useFormatCurrency';

function toMonthly(rec: RecurringTransaction): number {
  const amount = Number(rec.amount);
  switch (rec.frequency) {
    case 'WEEKLY':  return amount * (52 / 12);
    case 'MONTHLY': return amount;
    case 'YEARLY':  return amount / 12;
  }
}

const freqLabel: Record<string, string> = {
  WEEKLY: 'sett.',
  MONTHLY: 'mens.',
  YEARLY: 'ann.',
};

export default function SubscriptionCostCard() {
  const { formatCurrency } = useFormatCurrency();
  const { data: recurring = [], isLoading } = useQuery({
    queryKey: ['recurring'],
    queryFn: () => recurringApi.getAll(),
    staleTime: 3 * 60 * 1000,
  });

  if (isLoading) return <SkeletonCard />;

  const activeExpenses = recurring
    .filter((r) => r.isActive && r.type === 'EXPENSE')
    .map((r) => ({ ...r, monthly: toMonthly(r) }))
    .sort((a, b) => b.monthly - a.monthly);

  const totalMonthly = activeExpenses.reduce((s, r) => s + r.monthly, 0);
  const totalYearly = totalMonthly * 12;


  return (
    <div className="subscription-card">
      <div className="subscription-card-header">
        <div className="forecast-card-title-group">
          <RepeatIcon size={16} className="forecast-card-icon" />
          <div>
            <span className="forecast-card-title">Spese ricorrenti</span>
            <p className="forecast-card-subtitle">Spese fisse e abbonamenti attivi normalizzati al mese</p>
          </div>
        </div>
      </div>

      <div className="subscription-totals">
        <div className="subscription-total-main">
          <p className="subscription-total-label">Totale mensile</p>
          <p className="subscription-total-value">{formatCurrency(totalMonthly)}</p>
        </div>
        <div className="subscription-total-secondary">
          <p className="subscription-total-label">Annuale</p>
          <p className="subscription-yearly">{formatCurrency(totalYearly)}</p>
        </div>
      </div>

      {activeExpenses.length === 0 ? (
        <p className="subscription-empty">Nessuna spesa ricorrente attiva</p>
      ) : (
        <div className="subscription-list">
          {activeExpenses.slice(0, 6).map((rec) => (
            <div key={rec.id} className="subscription-item">
              <div className="subscription-item-info">
                {rec.category?.icon && (
                  <span className="subscription-item-icon">{rec.category.icon}</span>
                )}
                <span className="subscription-item-name">{rec.description}</span>
              </div>
              <div className="subscription-item-right">
                <span className="subscription-item-monthly">{formatCurrency(rec.monthly)}/m</span>
                <span className="subscription-item-freq">{freqLabel[rec.frequency]}</span>
              </div>
            </div>
          ))}
          {activeExpenses.length > 6 && (
            <p className="subscription-more">+{activeExpenses.length - 6} altri</p>
          )}
        </div>
      )}
    </div>
  );
}
