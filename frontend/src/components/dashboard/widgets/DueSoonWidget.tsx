import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarClock } from 'lucide-react';
import { usePending } from '../../../contexts/PendingContext';
import { useFormatCurrency } from '../../../hooks/useFormatCurrency';
import { formatDateShort } from '../../../utils/date';
import type { TransactionType } from '../../../types';

interface DueRow {
  id: string;
  description: string;
  date: string;
  amount: number;
  type: TransactionType;
  source: 'recurring' | 'planned';
  to: string;
}

// Widget "In scadenza" — ricorrenti + pianificate imminenti (riusa PendingContext).
export default function DueSoonWidget() {
  const navigate = useNavigate();
  const { recurringDueData, plannedDueData } = usePending();
  const { formatSignedCurrency } = useFormatCurrency();

  const rows = useMemo<DueRow[]>(() => {
    const recurring = [
      ...(recurringDueData?.overdue ?? []),
      ...(recurringDueData?.dueToday ?? []),
    ].map<DueRow>((r) => ({
      id: `rec-${r.id}`,
      description: r.description,
      date: r.nextDueDate,
      amount: Number(r.amount),
      type: r.type,
      source: 'recurring',
      to: '/recurring',
    }));

    const planned = plannedDueData.map<DueRow>((p) => ({
      id: `plan-${p.id}`,
      description: p.description,
      date: p.plannedDate,
      amount: Number(p.amount),
      type: p.type,
      source: 'planned',
      to: '/planned',
    }));

    return [...recurring, ...planned]
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 6);
  }, [recurringDueData, plannedDueData]);

  return (
    <div className="card due-soon">
      <div className="card-header">
        <h2 className="card-header-title">In scadenza</h2>
      </div>
      {rows.length === 0 ? (
        <div className="dashboard-empty-state">
          <CalendarClock size={20} className="due-soon-empty-icon" />
          Nessuna scadenza imminente
        </div>
      ) : (
        <div className="due-soon-list">
          {rows.map((row) => (
            <button
              key={row.id}
              type="button"
              className="due-soon-row"
              onClick={() => navigate(row.to)}
              aria-label={`Vai a ${row.source === 'recurring' ? 'ricorrenti' : 'pianificate'}: ${row.description}`}
            >
              <div className="due-soon-info">
                <span className="due-soon-name">{row.description}</span>
                <span className="due-soon-meta">
                  <span className={`due-soon-badge due-soon-badge-${row.source}`}>
                    {row.source === 'recurring' ? 'Ricorrente' : 'Pianificata'}
                  </span>
                  {formatDateShort(row.date)}
                </span>
              </div>
              <span
                className={`due-soon-amount${row.type === 'INCOME' ? ' is-income' : ' is-expense'}`}
              >
                {formatSignedCurrency(row.amount, row.type)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
