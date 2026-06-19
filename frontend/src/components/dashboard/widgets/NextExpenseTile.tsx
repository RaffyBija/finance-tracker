import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePending } from '../../../contexts/PendingContext';
import { useFormatCurrency } from '../../../hooks/useFormatCurrency';
import { formatDateShort } from '../../../utils/date';

// Tessera KPI "Prossima uscita": il prossimo movimento in uscita imminente
// (ricorrente o pianificato), per importo + data. Stato calmo se nulla in arrivo.
export default function NextExpenseTile() {
  const navigate = useNavigate();
  const { recurringDueData, plannedDueData } = usePending();
  const { formatCurrency } = useFormatCurrency();

  const next = useMemo(() => {
    const items = [
      ...(recurringDueData?.overdue ?? []),
      ...(recurringDueData?.dueToday ?? []),
    ]
      .filter((r) => r.type === 'EXPENSE')
      .map((r) => ({ name: r.description, date: r.nextDueDate, amount: Number(r.amount), to: '/recurring' }));

    plannedDueData
      .filter((p) => p.type === 'EXPENSE')
      .forEach((p) =>
        items.push({ name: p.description, date: p.plannedDate, amount: Number(p.amount), to: '/planned' })
      );

    return items.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0] ?? null;
  }, [recurringDueData, plannedDueData]);

  if (!next) {
    return (
      <div className="dashboard-tile dashboard-tile-empty">
        <span className="dashboard-tile-label">Prossima uscita</span>
        <span className="dashboard-tile-figure-muted">Nessuna in arrivo</span>
      </div>
    );
  }

  return (
    <button
      type="button"
      className="dashboard-tile dashboard-tile-next"
      onClick={() => navigate(next.to)}
      aria-label={`Prossima uscita: ${next.name}, ${formatCurrency(next.amount)} il ${formatDateShort(next.date)}`}
    >
      <span className="dashboard-tile-label">Prossima uscita</span>
      <span className="dashboard-tile-figure is-expense">−{formatCurrency(next.amount)}</span>
      <span className="dashboard-tile-meta">
        {next.name} · {formatDateShort(next.date)}
      </span>
    </button>
  );
}
